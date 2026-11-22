import type { Place } from '../types.js';
import { googleEventsSource } from './sources/googleEvents.js';
import { KNOWN_LOCALIST, localistSource } from './sources/localist.js';
import { ticketmasterSource } from './sources/ticketmaster.js';
import { KNOWN_WP_EVENTS, wpEventsSource } from './sources/wpEvents.js';
import type { LiveSource, SourceContext } from './sources/types.js';
import { PLAN_AHEAD_DAYS } from '../data/meta.js';
import { bostonDay, bostonParts, bostonWallTime } from './time.js';

interface SourceState {
  date: string;
  fetchedAt: number;
  ok: boolean;
  error?: string;
  events: Place[];
}

export interface LiveStatus {
  date: string;
  /** Upcoming across the whole plan-ahead range */
  total: number;
  /** Still on today */
  today: number;
  sources: { id: string; name: string; ok: boolean | null; count: number; error?: string; fetchedAt?: string }[];
}

// When two sources list the same thing, prefer the most authoritative one
const PRIORITY: Record<string, number> = { ticketmaster: 0, localist: 1, community: 2, google: 3 };
const RETRY_FAILED_MS = 10 * 60 * 1000;
/** Don't suggest anything that started more than this long ago */
export const LATE_GRACE_MS = 30 * 60 * 1000;

/**
 * Today's real events from every configured source, cached per source.
 * Requests never wait on the network: they get what's cached and kick off a
 * background refresh when something is stale. One failing source never takes
 * the others down.
 */
export class LiveEvents {
  private state = new Map<string, SourceState>();
  private inflight: Promise<void> | null = null;
  private timer?: NodeJS.Timeout;

  constructor(
    readonly sources: LiveSource[],
    private opts: { getJson?: (url: string) => Promise<unknown>; now?: () => Date; timeoutMs?: number; quiet?: boolean; days?: number } = {},
  ) {}

  private now() {
    return this.opts.now?.() ?? new Date();
  }

  private isStale(src: LiveSource, now: Date): boolean {
    const st = this.state.get(src.id);
    if (!st || st.date !== bostonParts(now).date) return true;
    return now.getTime() - st.fetchedAt > (st.ok ? src.refreshMs : RETRY_FAILED_MS);
  }

  /** Fetch every stale source (or all of them with force). Safe to call often. */
  refresh(force = false): Promise<void> {
    if (this.inflight) return this.inflight;
    const now = this.now();
    const due = this.sources.filter((s) => force || this.isStale(s, now));
    if (!due.length) return Promise.resolve();

    const day = bostonDay(now);
    const days = this.opts.days ?? PLAN_AHEAD_DAYS;
    const endDate = bostonParts(new Date(day.start.getTime() + (days - 1) * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000)).date;
    const ctx: SourceContext = {
      today: day.date,
      endDate,
      days,
      dayStart: day.start,
      dayEnd: new Date(bostonWallTime(endDate, 23, 59).getTime() + 60_000),
      now,
      getJson: this.opts.getJson ?? defaultGetJson(this.opts.timeoutMs ?? 20_000),
    };
    this.inflight = Promise.all(
      due.map(async (src) => {
        try {
          const events = await src.fetch(ctx);
          this.state.set(src.id, { date: day.date, fetchedAt: now.getTime(), ok: true, events });
          if (!this.opts.quiet) console.log(`[live] ${src.name}: ${events.length} events in the next ${days} days`);
        } catch (err) {
          const prev = this.state.get(src.id);
          this.state.set(src.id, {
            date: day.date,
            fetchedAt: now.getTime(),
            ok: false,
            error: describe(err),
            events: prev?.date === day.date ? prev.events : [], // keep today's last good data
          });
          if (!this.opts.quiet) console.warn(`[live] ${src.name} failed: ${describe(err)}`);
        }
      }),
    )
      .then(() => undefined)
      .finally(() => {
        this.inflight = null;
      });
    return this.inflight;
  }

  /** Non-blocking: refresh in the background if anything is stale */
  ensureFresh() {
    this.refresh().catch(() => undefined);
  }

  /** Everything still worth going to, from now through the plan-ahead range, de-duplicated */
  events(now = this.now()): Place[] {
    const t = now.getTime();
    const upcoming = [...this.state.values()]
      .flatMap((s) => s.events)
      .filter((p) => {
        const live = p.live!;
        if (live.timeTBA) return false; // no time = can't promise you'll catch it
        const start = Date.parse(live.startsAt);
        const end = live.endsAt ? Date.parse(live.endsAt) : start + p.minutes * 60_000;
        // drop-in hours (an exhibit): fine as long as there's time left to see it
        if (live.openHours) return end >= t + 30 * 60_000;
        // a show: only if it started no more than 30 minutes ago
        return start >= t - LATE_GRACE_MS;
      })
      .sort((a, b) => (PRIORITY[a.live!.source] ?? 9) - (PRIORITY[b.live!.source] ?? 9));

    const byKey = new Map<string, Place>();
    for (const p of upcoming) {
      const key = `${p.name.toLowerCase().replace(/[^a-z0-9]/g, '')}|${p.live!.startsAt.slice(0, 13)}`;
      if (!byKey.has(key)) byKey.set(key, p);
    }
    return [...byKey.values()].sort((a, b) => a.live!.startsAt.localeCompare(b.live!.startsAt));
  }

  get(id: string): Place | undefined {
    for (const s of this.state.values()) {
      const hit = s.events.find((e) => e.id === id);
      if (hit) return hit;
    }
    return undefined;
  }

  status(now = this.now()): LiveStatus {
    const all = this.events(now);
    const today = bostonParts(now).date;
    return {
      date: today,
      total: all.length,
      today: all.filter((p) => bostonParts(new Date(Math.max(Date.parse(p.live!.startsAt), now.getTime()))).date === today).length,
      sources: this.sources.map((s) => {
        const st = this.state.get(s.id);
        return {
          id: s.id,
          name: s.name,
          ok: st ? st.ok : null,
          count: st ? st.events.length : 0,
          error: st?.error,
          fetchedAt: st ? new Date(st.fetchedAt).toISOString() : undefined,
        };
      }),
    };
  }

  /** Fetch now, then keep things fresh in the background */
  start(checkEveryMs = 15 * 60 * 1000) {
    this.ensureFresh();
    this.timer = setInterval(() => this.ensureFresh(), checkEveryMs);
    this.timer.unref();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }
}

function defaultGetJson(timeoutMs: number) {
  return async (url: string) => {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'common-boston/1.0 (student hackathon project)' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    // never echo the URL: it can contain an API key
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
    return res.json();
  };
}

function describe(err: unknown): string {
  if (err instanceof Error) return err.name === 'TimeoutError' ? 'timed out' : err.message;
  return String(err);
}

/** Which sources to use, from environment variables (see backend/.env.example) */
export function liveSourcesFromEnv(env: NodeJS.ProcessEnv = process.env): LiveSource[] {
  if (/^(off|false|0|no)$/i.test(env.LIVE_EVENTS ?? '')) return [];
  const sources: LiveSource[] = [];
  const domains = (env.LOCALIST_CALENDARS ?? KNOWN_LOCALIST.map((c) => c.domain).join(','))
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean);
  for (const domain of domains) {
    const cal = KNOWN_LOCALIST.find((c) => c.domain === domain);
    if (cal) sources.push(localistSource(cal));
    else console.warn(`[live] Unknown Localist calendar "${domain}": add it to KNOWN_LOCALIST with its campus info`);
  }
  const sites = (env.COMMUNITY_CALENDARS ?? KNOWN_WP_EVENTS.map((c) => c.domain).join(','))
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean);
  for (const domain of sites) {
    const site = KNOWN_WP_EVENTS.find((c) => c.domain === domain);
    if (site) sources.push(wpEventsSource(site));
    else console.warn(`[live] Unknown community calendar "${domain}": add it to KNOWN_WP_EVENTS`);
  }
  if (env.TICKETMASTER_API_KEY) sources.push(ticketmasterSource(env.TICKETMASTER_API_KEY));
  if (env.SERPAPI_API_KEY) sources.push(googleEventsSource(env.SERPAPI_API_KEY, Number(env.GOOGLE_EVENTS_REFRESH_HOURS) || 12));
  return sources;
}
