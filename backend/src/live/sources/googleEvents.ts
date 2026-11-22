import type { Place, PriceTier } from '../../types.js';
import { APPROX_T_STOP, inRange, neighborhoodCenter, neighborhoodForAddress } from '../geo.js';
import { decodeHtml, cleanText, emojiFor, shortHash, tagsFor } from '../tags.js';
import { bostonWallTime, timesForRange } from '../time.js';
import type { LiveSource, SourceContext } from './types.js';

/**
 * Google's event listings via SerpApi (Google has no public events API).
 * Free tier available at serpapi.com → SERPAPI_API_KEY. Each refresh costs one
 * search, so this source refreshes rarely.
 */
interface GoogleEvent {
  title: string;
  date?: { start_date?: string; when?: string };
  address?: string[];
  link?: string;
  description?: string;
  ticket_info?: { source?: string; link?: string; link_type?: string }[];
  venue?: { name?: string };
}

export function googleEventsSource(apiKey: string, refreshHours = 12): LiveSource {
  return {
    id: 'google',
    name: 'Google Events',
    refreshMs: refreshHours * 60 * 60 * 1000,
    async fetch(ctx) {
      const params = new URLSearchParams({
        engine: 'google_events',
        q: 'Events in Boston',
        hl: 'en',
        gl: 'us',
        htichips: 'date:week', // Google's "this week" filter
        api_key: apiKey,
      });
      return normalizeGoogleEvents(await ctx.getJson(`https://serpapi.com/search.json?${params}`), ctx);
    },
  };
}

const RANGE = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[–—-]\s*(?:[A-Za-z]{3},?\s+[A-Za-z]{3,9}\.?\s+\d{1,2},?\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i;
const SINGLE = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i;

function to24(h: number, min: number, mer: string): [number, number] {
  const m = mer.toLowerCase();
  if (m === 'pm' && h < 12) h += 12;
  if (m === 'am' && h === 12) h = 0;
  return [h, min];
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Google's "Nov 22" → "2026-11-22" (rolling into next year for January listings in December) */
export function googleDate(startDate: string | undefined, today: string): string | null {
  if (!startDate) return today;
  const m = startDate.match(/([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})/);
  if (!m) return null;
  const month = MONTHS.indexOf(m[1].toLowerCase());
  if (month < 0) return null;
  let year = Number(today.slice(0, 4));
  if (month + 1 < Number(today.slice(5, 7)) - 1) year += 1;
  return `${year}-${String(month + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}

/** "Sat, Nov 22, 7 – 10 PM" → 19:00–22:00 on `today`. Null when there's no time. */
export function parseWhen(when: string, today: string): { start: Date; end?: Date } | null {
  // drop the leading date ("Sat, Nov 22,") so its day number isn't read as a time
  const timePart = when.replace(/^[^,]*,\s*[A-Za-z]{3,9}\.?\s+\d{1,2},?\s*/, '');
  const range = timePart.match(RANGE);
  if (range) {
    const endMer = range[6];
    const [sh, sm] = to24(Number(range[1]), Number(range[2] ?? 0), range[3] ?? endMer);
    const [eh, em] = to24(Number(range[4]), Number(range[5] ?? 0), endMer);
    const start = bostonWallTime(today, sh, sm);
    let end = bostonWallTime(today, eh, em);
    if (end <= start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000); // runs past midnight
    return { start, end };
  }
  const single = timePart.match(SINGLE);
  if (!single) return null;
  const [h, m] = to24(Number(single[1]), Number(single[2] ?? 0), single[3]);
  return { start: bostonWallTime(today, h, m) };
}

export function normalizeGoogleEvents(json: unknown, ctx: Pick<SourceContext, 'today' | 'endDate' | 'now'>): Place[] {
  const results: GoogleEvent[] = (json as { events_results?: GoogleEvent[] })?.events_results ?? [];
  const out: Place[] = [];
  for (const r of results) {
    const address = (r.address ?? []).join(', ');
    const hood = neighborhoodForAddress(address) ?? (r.venue?.name ? neighborhoodForAddress(r.venue.name) : null);
    if (!hood) continue;

    const when = r.date?.when ?? '';
    const day = googleDate(r.date?.start_date, ctx.today);
    if (!day || !inRange(day, ctx)) continue;
    const parsed = parseWhen(when, day);
    const start = parsed?.start ?? bostonWallTime(day, 12);
    const end = parsed?.end;
    const tags = new Set(tagsFor(`${r.title} ${r.venue?.name ?? ''}`, r.description ?? ''));
    if (!tags.size) tags.add('Small events');
    const free = /\bfree\b/i.test(`${r.title} ${r.description ?? ''}`);
    const price: PriceTier = free ? 'free' : '10to20';
    const minutes = end ? Math.round((end.getTime() - start.getTime()) / 60_000) : 120;
    const center = neighborhoodCenter(hood);
    const tickets = r.ticket_info?.find((t) => t.link_type === 'tickets')?.link;

    out.push({
      id: `live-g-${shortHash(`${r.title}|${when}|${address}`)}`,
      name: decodeHtml(r.title).trim(),
      type: 'event',
      neighborhood: hood,
      price,
      priceNote: free ? 'Free' : 'Price not listed: check the event page',
      minutes: Math.max(30, Math.min(minutes, 600)),
      tags: [...tags],
      times: timesForRange(start, end ?? new Date(start.getTime() + minutes * 60_000)),
      address: address || r.venue?.name || '',
      lat: center[0],
      lng: center[1],
      tStop: APPROX_T_STOP[hood],
      emoji: emojiFor([...tags], 'event'),
      blurb: cleanText(r.description, 180) || `Happening at ${r.venue?.name ?? address}.`,
      localTip: 'Found via Google’s event listings. Confirm details on the event page.',
      live: {
        source: 'google',
        sourceName: 'Google Events',
        url: r.link ?? tickets ?? 'https://www.google.com/search?q=events+in+boston+today',
        ticketUrl: tickets,
        startsAt: start.toISOString(),
        endsAt: end?.toISOString(),
        endEstimated: !end,
        timeTBA: !parsed,
        venue: r.venue?.name,
        approxLocation: true,
        fetchedAt: ctx.now.toISOString(),
      },
    });
  }
  return out;
}
