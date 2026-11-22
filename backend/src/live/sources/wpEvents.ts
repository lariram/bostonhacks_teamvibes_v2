import type { NeighborhoodId, Place, PlaceType, PriceTier } from '../../types.js';
import { APPROX_T_STOP, inRange, neighborhoodCenter, neighborhoodForAddress, placeForPoint } from '../geo.js';
import { nearestStop } from '../stations.js';
import { cleanText, decodeHtml, emojiFor, priceTierFor, tagsFor } from '../tags.js';
import { bostonParts, bostonWallTime, timesForRange } from '../time.js';
import { knownVenue } from '../venues.js';
import type { LiveSource, SourceContext } from './types.js';

/**
 * Community calendars built on WordPress's "The Events Calendar" plugin, which
 * exposes a public JSON API at /wp-json/tribe/events/v1/events. No key needed.
 */
export interface WpEventsSite {
  domain: string;
  name: string;
  short: string;
}

export const KNOWN_WP_EVENTS: WpEventsSite[] = [
  { domain: 'www.downtownboston.org', name: 'Downtown Boston', short: 'dtb' },
  { domain: 'massachusetts250.org', name: 'Massachusetts 250', short: 'ma250' },
  { domain: 'www.sowaboston.com', name: 'SoWa Boston', short: 'sowa' },
];

interface WpEvent {
  id: number;
  title: string;
  url?: string;
  website?: string;
  description?: string;
  excerpt?: string;
  status?: string;
  all_day?: boolean;
  is_virtual?: boolean;
  hide_from_listings?: boolean;
  start_date?: string;
  end_date?: string;
  utc_start_date?: string;
  utc_end_date?: string;
  cost?: string;
  image?: { url?: string; sizes?: Record<string, { url?: string }> } | false;
  cost_details?: { values?: (string | number)[] };
  categories?: { name: string }[];
  tags?: { name: string }[];
  venue?: { venue?: string; address?: string; city?: string; zip?: string; geo_lat?: number | string; geo_lng?: number | string } | unknown[];
}

const MAX_PAGES = 6;

export function wpEventsSource(site: WpEventsSite): LiveSource {
  return {
    id: `wp:${site.domain}`,
    name: site.name,
    refreshMs: 3 * 60 * 60 * 1000,
    async fetch(ctx) {
      let url: string | undefined =
        `https://${site.domain}/wp-json/tribe/events/v1/events?start_date=${ctx.today}&end_date=${ctx.endDate}%2023:59:59&per_page=50`;
      const out: Place[] = [];
      for (let page = 0; url && page < MAX_PAGES; page++) {
        const json = (await ctx.getJson(url)) as { events?: WpEvent[]; next_rest_url?: string };
        out.push(...normalizeWpEvents(json, site, ctx));
        const next: string | undefined = json?.next_rest_url;
        url = next && new URL(next).host === site.domain ? next : undefined; // never follow off-site
      }
      return out;
    },
  };
}

/**
 * Local wall time ("2026-11-24 10:00:00") read as Boston time. We don't trust the
 * "utc_" fields: some sites have their WordPress timezone set to UTC by mistake,
 * which shifts everything five hours. Every site we read is in Boston.
 */
function boston(local?: string): Date | undefined {
  const m = local?.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/);
  return m ? bostonWallTime(m[1], Number(m[2]), Number(m[3])) : undefined;
}

export function normalizeWpEvents(json: unknown, site: WpEventsSite, ctx: Pick<SourceContext, 'today' | 'endDate' | 'now'>): Place[] {
  const events: WpEvent[] = (json as { events?: WpEvent[] })?.events ?? [];
  const out: Place[] = [];

  for (const e of events) {
    if (e.is_virtual || e.hide_from_listings || (e.status && e.status !== 'publish')) continue;
    const v = e.venue && !Array.isArray(e.venue) ? e.venue : undefined;
    if (!v?.venue && !v?.address) continue;

    // Where: coordinates → a venue we already know → address/ZIP
    // a venue we know, or the same show we already know ("Boston Ballet's The Nutcracker")
    const title = decodeHtml(e.title).trim();
    const known = knownVenue(v.venue) ?? knownVenue(title);
    const lat = Number(v.geo_lat);
    const lng = Number(v.geo_lng);
    let point: [number, number] | null = null;
    let hood: NeighborhoodId | null = null;
    if (v.geo_lat && Number.isFinite(lat) && Number.isFinite(lng)) {
      point = [lat, lng];
      hood = placeForPoint(lat, lng);
    } else if (known) {
      point = [known.lat, known.lng];
      hood = known.neighborhood;
    } else {
      hood = neighborhoodForAddress([v.address, v.city, v.zip].filter(Boolean).join(', '));
    }
    if (!hood) continue; // outside our neighborhoods (the statewide calendars list a lot)

    // When
    let start = boston(e.start_date) ?? undefined;
    let end = boston(e.end_date);
    if (!start || Number.isNaN(start.getTime())) continue;
    const rangeStart = bostonWallTime(ctx.today, 0);
    const rangeEnd = bostonWallTime(ctx.endDate, 23, 59);
    if (start > rangeEnd || (end && end < rangeStart)) continue;
    const startDay = bostonParts(start).date;
    let endEstimated = false;
    // Drop-in hours: all-day listings, exhibits, and multi-day runs (an exhibit that
    // opened last week and closes in January). Multi-day runs keep their real span;
    // the recommender applies the daily hours.
    let openHours = !!e.all_day || (e.categories ?? []).some((c) => /exhibit/i.test(c.name));
    if (e.all_day) {
      start = bostonWallTime(startDay, 10);
      end = bostonWallTime(end ? bostonParts(end).date : startDay, 17);
      endEstimated = true;
    } else if (end && bostonParts(end).date !== startDay) {
      openHours = true;
    }
    if (!openHours && !inRange(startDay, ctx)) continue;
    if (!end) {
      end = new Date(start.getTime() + 120 * 60_000);
      endEstimated = true;
    }

    const cats = [...(e.categories ?? []), ...(e.tags ?? [])].map((c) => decodeHtml(c.name));
    const tags = new Set(tagsFor([title, ...cats, v.venue ?? ''].join(' '), e.description ?? ''));
    if (cats.some((c) => /exhibit/i.test(c))) tags.add('Museums');
    if (cats.some((c) => /outdoor/i.test(c))) tags.add('Nature');
    if (cats.some((c) => /history/i.test(c))) tags.add('History');
    if (!tags.size) tags.add('Small events');

    const minutes = openHours ? dailyMinutes(start, end) : Math.round((end.getTime() - start.getTime()) / 60_000);
    const type: PlaceType = minutes >= 240 || cats.some((c) => /exhibit/i.test(c)) ? 'activity' : 'event';

    // Price: "Free", "$55", "Free – $18", "Regular museum admission"
    const cost = decodeHtml(e.cost ?? '').trim();
    const amounts = (e.cost_details?.values ?? []).map(Number).filter(Number.isFinite);
    let price: PriceTier = '10to20';
    let priceNote = cost || 'Price not listed: check the event page';
    if (/^free\b/i.test(cost) || (amounts.length && Math.min(...amounts) === 0)) {
      price = 'free';
      priceNote = cost || 'Free';
    } else if (amounts.length) price = priceTierFor(Math.min(...amounts));
    else if (/\$\s*\d/.test(cost)) price = priceTierFor(Number(cost.match(/\$\s*(\d+(?:\.\d+)?)/)![1]));
    else if (!cost && known) {
      price = known.price; // no price listed, but we know this show/venue
      priceNote = known.priceNote;
    }

    const at = point ?? neighborhoodCenter(hood);
    out.push({
      id: `live-${site.short}-${e.id}`,
      name: title,
      type,
      neighborhood: hood,
      price,
      priceNote,
      minutes: Math.max(30, Math.min(minutes, 600)),
      tags: [...tags],
      times: timesForRange(start, end),
      address: [v.venue, v.address, [v.city, v.zip].filter(Boolean).join(' ')].filter(Boolean).map((x) => decodeHtml(String(x))).join(', '),
      lat: at[0],
      lng: at[1],
      tStop: known?.tStop ?? (point ? nearestStop(point[0], point[1]) : null) ?? APPROX_T_STOP[hood],
      emoji: emojiFor([...tags], type),
      blurb: cleanText(e.excerpt || e.description, 180) || `At ${decodeHtml(v.venue ?? '')}.`,
      localTip: known?.localTip ?? `Listed on the ${site.name} calendar. Check the event page for tickets and times.`,
      image: (() => {
        const im = e.image || undefined;
        const url = im?.sizes?.medium_large?.url ?? im?.sizes?.large?.url ?? im?.url;
        return url ? { url, credit: site.name, creditUrl: e.url, source: 'event' as const } : undefined;
      })(),
      live: {
        source: 'community',
        sourceName: site.name,
        url: e.url ?? `https://${site.domain}`,
        ticketUrl: e.website || undefined,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        endEstimated,
        openHours,
        venue: v.venue ? decodeHtml(v.venue) : undefined,
        approxLocation: !point,
        area: hood === 'greater' ? v.city : undefined,
        fetchedAt: ctx.now.toISOString(),
      },
    });
  }
  return out;
}

/** For drop-in hours: minutes open per day (10:00–17:00 → 420) */
function dailyMinutes(start: Date, end: Date): number {
  const a = bostonParts(start);
  const b = bostonParts(end);
  const m = b.hour * 60 + b.minute - (a.hour * 60 + a.minute);
  return m > 0 ? m : 420;
}
