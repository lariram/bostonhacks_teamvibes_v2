import type { Place, PriceTier } from '../../types.js';
import { nearestStop } from '../stations.js';
import { APPROX_T_STOP, neighborhoodCenter, neighborhoodForAddress, neighborhoodForPoint } from '../geo.js';
import { cleanText, emojiFor, priceTierFor, tagsFor } from '../tags.js';
import { bostonParts, bostonWallTime, timesForRange } from '../time.js';
import type { LiveSource, SourceContext } from './types.js';

/**
 * Ticketmaster Discovery API: concerts, sports, comedy and theater at Boston
 * venues. Free key from developer.ticketmaster.com → TICKETMASTER_API_KEY.
 */
interface TmEvent {
  id: string;
  name: string;
  url?: string;
  info?: string;
  pleaseNote?: string;
  dates?: {
    start?: { localDate?: string; localTime?: string; dateTime?: string; timeTBA?: boolean; noSpecificTime?: boolean };
    status?: { code?: string };
  };
  classifications?: { segment?: { name?: string }; genre?: { name?: string }; subGenre?: { name?: string } }[];
  priceRanges?: { min?: number; max?: number }[];
  _embedded?: {
    venues?: {
      name?: string;
      postalCode?: string;
      address?: { line1?: string };
      city?: { name?: string };
      state?: { stateCode?: string };
      location?: { latitude?: string; longitude?: string };
    }[];
  };
}

const MINUTES_BY_SEGMENT: Record<string, number> = { Sports: 180, Music: 150, 'Arts & Theatre': 150, Film: 120 };

const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');

export function ticketmasterSource(apiKey: string): LiveSource {
  return {
    id: 'ticketmaster',
    name: 'Ticketmaster',
    refreshMs: 2 * 60 * 60 * 1000,
    async fetch(ctx) {
      const params = new URLSearchParams({
        apikey: apiKey,
        latlong: '42.3601,-71.0589',
        radius: '6',
        unit: 'miles',
        startDateTime: iso(ctx.dayStart),
        endDateTime: iso(ctx.dayEnd),
        size: '200',
        sort: 'date,asc',
        locale: '*',
      });
      return normalizeTicketmaster(await ctx.getJson(`https://app.ticketmaster.com/discovery/v2/events.json?${params}`), ctx);
    },
  };
}

export function normalizeTicketmaster(json: unknown, ctx: Pick<SourceContext, 'today' | 'now'>): Place[] {
  const events: TmEvent[] = (json as { _embedded?: { events?: TmEvent[] } })?._embedded?.events ?? [];
  const seen = new Set<string>();
  const out: Place[] = [];

  for (const ev of events) {
    const status = ev.dates?.status?.code?.toLowerCase();
    if (status && /cancel|postpone|reschedul|offsale/.test(status)) continue;
    const v = ev._embedded?.venues?.[0];
    if (!v) continue;

    const lat = Number(v.location?.latitude);
    const lng = Number(v.location?.longitude);
    const hood = (v.location ? neighborhoodForPoint(lat, lng) : null) ?? (v.postalCode ? neighborhoodForAddress(v.postalCode) : null);
    if (!hood) continue;
    const point: [number, number] = Number.isFinite(lat) && v.location ? [lat, lng] : neighborhoodCenter(hood);

    const s = ev.dates?.start ?? {};
    const timeTBA = !!(s.timeTBA || s.noSpecificTime || (!s.dateTime && !s.localTime));
    let start: Date;
    if (s.dateTime) start = new Date(s.dateTime);
    else if (s.localDate && s.localTime) {
      const [h, m] = s.localTime.split(':').map(Number);
      start = bostonWallTime(s.localDate, h, m);
    } else if (s.localDate) start = bostonWallTime(s.localDate, 19);
    else continue;
    if (Number.isNaN(start.getTime()) || bostonParts(start).date !== ctx.today) continue;

    // Ticketmaster often lists VIP/parking packages as separate "events"
    const name = ev.name.replace(/\s*[-–:|]\s*(vip|premium|parking|package|upgrade).*$/i, '').trim();
    const key = `${name.toLowerCase()}|${v.name}|${start.toISOString()}`;
    if (seen.has(key) || /\b(parking|vip package|upgrade)\b/i.test(ev.name)) continue;
    seen.add(key);

    const c = ev.classifications?.[0] ?? {};
    const segment = c.segment?.name ?? '';
    const genre = [c.genre?.name, c.subGenre?.name].filter((g) => g && g !== 'Undefined' && g !== 'Other').join(' ');
    const tags = new Set(tagsFor(`${name} ${segment} ${genre}`, ev.info ?? ''));
    if (segment === 'Music') tags.add('Live music');
    if (segment === 'Sports') tags.add('Sporting events');
    if (segment === 'Arts & Theatre' && !tags.has('Comedy')) tags.add('Performing arts');
    if (segment === 'Music' || segment === 'Sports') tags.add('50+ people');
    if (!tags.size) tags.add('Small events');

    const pr = ev.priceRanges?.[0];
    let price: PriceTier = '20to40';
    let priceNote = 'Price not listed: check Ticketmaster';
    if (pr && typeof pr.min === 'number') {
      price = priceTierFor(pr.min);
      priceNote = pr.max && pr.max > pr.min ? `$${Math.round(pr.min)}–$${Math.round(pr.max)}` : `From $${Math.round(pr.min)}`;
    }

    const minutes = MINUTES_BY_SEGMENT[segment] ?? 150;
    const end = new Date(start.getTime() + minutes * 60_000);
    const address = [v.address?.line1, v.city?.name, [v.state?.stateCode, v.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    const what = genre || segment || 'Event';

    out.push({
      id: `live-tm-${ev.id}`,
      name,
      type: 'event',
      neighborhood: hood,
      price,
      priceNote,
      minutes,
      tags: [...tags],
      times: timesForRange(start, end),
      address: address || v.name || '',
      lat: point[0],
      lng: point[1],
      tStop: (v.location ? nearestStop(point[0], point[1]) : null) ?? APPROX_T_STOP[hood],
      emoji: emojiFor([...tags], 'event'),
      blurb: cleanText(ev.info, 180) || `${what} at ${v.name ?? 'a Boston venue'}.`,
      localTip: cleanText(ev.pleaseNote, 160) || 'Ticket prices change, so check Ticketmaster before you go.',
      live: {
        source: 'ticketmaster',
        sourceName: 'Ticketmaster',
        url: ev.url ?? 'https://www.ticketmaster.com',
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        endEstimated: true,
        timeTBA,
        venue: v.name,
        fetchedAt: ctx.now.toISOString(),
      },
    });
  }
  return out;
}
