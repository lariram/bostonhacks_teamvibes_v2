import type { NeighborhoodId, Place, PlaceType, PriceTier } from '../../types.js';
import { nearestStop } from '../stations.js';
import { APPROX_T_STOP, neighborhoodCenter, neighborhoodForAddress, neighborhoodForPoint } from '../geo.js';
import { cleanText, decodeHtml, emojiFor, priceTierFor, tagsFor } from '../tags.js';
import { distanceKm } from '../geo.js';
import { bostonParts, bostonWallTime, parseClock, timesForRange } from '../time.js';
import type { LiveSource, SourceContext } from './types.js';

/**
 * Localist is the calendar platform many universities use, with a public JSON
 * API (no key). Campus events are a great fit for "America's college city".
 */
export interface LocalistCalendar {
  domain: string;
  name: string;
  short: string;
  institution: string;
  city: string;
  campus: NeighborhoodId;
  lat: number;
  lng: number;
}

export const KNOWN_LOCALIST: LocalistCalendar[] = [
  { domain: 'calendar.mit.edu', name: 'MIT Events', short: 'mit', institution: 'MIT', city: 'Cambridge, MA', campus: 'cambridge', lat: 42.3601, lng: -71.0942 },
  { domain: 'calendar.northeastern.edu', name: 'Northeastern Events', short: 'neu', institution: 'Northeastern University', city: 'Boston, MA', campus: 'fenway', lat: 42.3398, lng: -71.0892 },
  { domain: 'butodayevents.bu.edu', name: 'BU Events', short: 'bu', institution: 'Boston University', city: 'Boston, MA', campus: 'allston', lat: 42.3505, lng: -71.1054 },
  { domain: 'events.bc.edu', name: 'Boston College Events', short: 'bc', institution: 'Boston College', city: 'Chestnut Hill, MA', campus: 'brighton', lat: 42.3355, lng: -71.1685 },
];

// Academic/admin events aren't "things to do"
const SKIP_TYPE = /(seminar|lecture|conference|career|meeting|information session|info session|training|thesis|defen[cs]e|webinar|admission|recruit|orientation|office hours|religious|class|course|deadline|luncheon|presentation|employer)/i;
const SKIP_TITLE =
  /\b(info(rmation)? sessions?|office hours|seminar|colloquium|defen[cs]e|thesis|webinar|internship|career|recruit\w*|orientation|deadline|virtual|zoom|class:|course|faculty|staff meeting|dissertation|symposium|workshop series for|software|demonstration|poster|research|coffee chat|networking|admissions|q&a|employers?|rehearsal|auditions?)\b/i;

interface LocalistEvent {
  id: number;
  title: string;
  url?: string | null;
  localist_url?: string;
  location_name?: string;
  room_number?: string | null;
  address?: string;
  experience?: string;
  status?: string;
  free?: boolean;
  ticket_cost?: string | null;
  ticket_url?: string | null;
  description_text?: string;
  keywords?: string[];
  tags?: string[];
  geo?: { latitude?: string | number | null; longitude?: string | number | null; zip?: string | null };
  filters?: { event_types?: { name: string }[] };
  event_instances?: { event_instance: { id: number; start: string; end?: string | null; all_day?: boolean } }[];
}

export function localistSource(cal: LocalistCalendar): LiveSource {
  return {
    id: `localist:${cal.domain}`,
    name: cal.name,
    refreshMs: 2 * 60 * 60 * 1000,
    async fetch(ctx) {
      const json = await ctx.getJson(`https://${cal.domain}/api/2/events?start=${ctx.today}&days=1&pp=100`);
      return normalizeLocalist(json, cal, ctx);
    },
  };
}

export function normalizeLocalist(json: unknown, cal: LocalistCalendar, ctx: Pick<SourceContext, 'today' | 'now'>): Place[] {
  const events = ((json as { events?: { event: LocalistEvent }[] })?.events ?? []).map((x) => x.event).filter(Boolean);
  const out: Place[] = [];

  for (const e of events) {
    if (e.experience === 'virtual' || (e.status && e.status !== 'live')) continue;
    if (/\b(zoom|online|virtual|teams|webex)\b/i.test(e.location_name ?? '')) continue;
    const types = (e.filters?.event_types ?? []).map((t) => t.name);
    if (SKIP_TITLE.test(e.title)) continue;
    if (types.length && types.every((t) => SKIP_TYPE.test(t))) continue;

    const desc = e.description_text ?? '';
    // Athletics listings put the real location/time in the description ("Location: Norton, MA")
    const descLocation = desc.match(/Location:\s*([^\n]+)/i)?.[1]?.trim();
    const descTime = desc.match(/Time:\s*([^\n]+)/i)?.[1];

    // Where is it? Real coordinates beat address beat description beat "somewhere on campus".
    const lat = Number(e.geo?.latitude);
    const lng = Number(e.geo?.longitude);
    let hood: NeighborhoodId | null = null;
    let point: [number, number] | null = null;
    let approx = false;
    if (Number.isFinite(lat) && Number.isFinite(lng) && e.geo?.latitude) {
      // On (or right by) campus? It's the campus neighborhood, even if a
      // map anchor across the river is technically closer.
      hood = distanceKm([lat, lng], [cal.lat, cal.lng]) < 1.3 ? cal.campus : neighborhoodForPoint(lat, lng);
      point = [lat, lng];
    } else if (e.address) {
      hood = neighborhoodForAddress(e.address);
    } else if (descLocation) {
      hood = neighborhoodForAddress(descLocation);
    } else if (e.location_name) {
      hood = cal.campus;
      point = [cal.lat, cal.lng];
    }
    if (!hood) continue; // away games and out-of-town events
    if (!point) {
      point = hood === cal.campus ? [cal.lat, cal.lng] : neighborhoodCenter(hood);
      approx = hood !== cal.campus;
    }

    const isAthletics = types.some((t) => /athletic|sport/i.test(t));
    // "BC Women's Hockey at Northeastern" is an away game; home games say "vs."
    if (isAthletics && /\s(at|@)\s/i.test(e.title)) continue;
    const tags = new Set(tagsFor([e.title, ...types, ...(e.keywords ?? []), ...(e.tags ?? [])].join(' '), desc));
    if (isAthletics) ['Sporting events', 'College sports', '50+ people'].forEach((t) => tags.add(t));
    if (types.some((t) => /exhibit/i.test(t))) tags.add('Museums');
    if (types.some((t) => /^music$/i.test(t))) tags.add('Live music');
    if (types.some((t) => /performing arts/i.test(t))) tags.add('Performing arts');
    if (!tags.size) tags.add('Small events');

    const cost = e.ticket_cost?.trim() ?? '';
    const amount = Number(cost.replace(/[^0-9.]/g, ''));
    let price: PriceTier = 'under10';
    let priceNote = 'Cost not listed (many campus events are free)';
    if (e.free || /free/i.test(cost) || cost === '0') {
      price = 'free';
      priceNote = 'Free';
    } else if (cost && Number.isFinite(amount) && /\d/.test(cost)) {
      price = priceTierFor(amount);
      priceNote = cost.startsWith('$') ? cost : `$${amount}`;
    }

    for (const { event_instance: inst } of e.event_instances ?? []) {
      let start = new Date(inst.start);
      if (Number.isNaN(start.getTime()) || bostonParts(start).date !== ctx.today) continue;
      let end = inst.end ? new Date(inst.end) : undefined;
      let timeTBA = false;
      if (inst.all_day) {
        start = bostonWallTime(ctx.today, 9);
        end = bostonWallTime(ctx.today, 17);
      } else if (!inst.end && bostonParts(start).hour < 5) {
        // placeholder time; try the description, otherwise mark it TBA
        const clock = descTime ? parseClock(descTime) : null;
        if (clock) start = bostonWallTime(ctx.today, clock[0], clock[1]);
        else {
          start = bostonWallTime(ctx.today, 12);
          timeTBA = true;
        }
      }
      const minutes = end ? Math.round((end.getTime() - start.getTime()) / 60_000) : isAthletics ? 120 : 90;
      const longRunning = minutes >= 240 || types.some((t) => /exhibit/i.test(t));
      const type: PlaceType = longRunning || types.some((t) => /workshop|fair/i.test(t)) ? 'activity' : 'event';
      const venue = [e.location_name, e.room_number].filter(Boolean).join(', ');

      out.push({
        id: `live-${cal.short}-${e.id}-${inst.id}`,
        name: decodeHtml(e.title).trim(),
        type,
        neighborhood: hood,
        price,
        priceNote,
        minutes: Math.max(30, Math.min(minutes, 600)),
        tags: [...tags],
        times: timesForRange(start, end),
        address: e.address || [venue || descLocation, cal.institution, cal.city].filter(Boolean).join(', '),
        lat: point[0],
        lng: point[1],
        tStop: (approx ? null : nearestStop(point[0], point[1])) ?? APPROX_T_STOP[hood],
        emoji: emojiFor([...tags], type),
        blurb:
          cleanText(desc.replace(/(Time|Location):[^\n]*/gi, ''), 180) ||
          `${types[0] ?? 'Event'} at ${cal.institution}.`,
        localTip: 'Campus event: double-check it’s open to the public before you go.',
        live: {
          source: 'localist',
          sourceName: cal.name,
          url: e.localist_url || e.url || `https://${cal.domain}`,
          ticketUrl: e.ticket_url || undefined,
          startsAt: start.toISOString(),
          endsAt: end?.toISOString(),
          endEstimated: !end,
          timeTBA,
          venue: venue || undefined,
          campus: true,
          approxLocation: approx,
          fetchedAt: ctx.now.toISOString(),
        },
      });
    }
  }
  return out;
}
