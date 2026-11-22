import type { Place } from '../types.js';
import { googleEventsSource } from './sources/googleEvents.js';
import { KNOWN_LOCALIST, localistSource } from './sources/localist.js';
import { ticketmasterSource } from './sources/ticketmaster.js';
import type { LiveSource, SourceContext } from './sources/types.js';
import { bostonDay, bostonParts } from './time.js';

interface SourceState {
  date: string;
  fetchedAt: number;
  ok: boolean;
  error?: string;
  events: Place[];
}

export interface LiveStatus {
  date: string;
  total: number;
  sources: { id: string; name: string; ok: boolean | null; count: number; error?: string; fetchedAt?: string }[];
}

// When two sources list the same thing, prefer the most authoritative one
const PRIORITY: Record<string, number> = { ticketmaster: 0, localist: 1, google: 2 };
const RETRY_FAILED_MS = 10 * 60 * 1000;

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
    private opts: { getJson?: (url: string) => Promise<unknown>; now?: () => Date; timeoutMs?: number; quiet?: boolean } = {},
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
    const ctx: SourceContext = {
      today: day.date,
      dayStart: day.start,
      dayEnd: day.end,
      now,
      getJson: this.opts.getJson ?? defaultGetJson(this.opts.timeoutMs ?? 10_000),
    };
    this.inflight = Promise.all(
      due.map(async (src) => {
        try {
          const events = await src.fetch(ctx);
          this.state.set(src.id, { date: day.date, fetchedAt: now.getTime(), ok: true, events });
          if (!this.opts.quiet) console.log(`[live] ${src.name}: ${events.length} events today`);
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

  /** Events still worth going to right now, de-duplicated across sources */
  events(now = this.now()): Place[] {
    const today = bostonParts(now).date;
    const t = now.getTime();
    const upcoming = [...this.state.values()]
      .filter((s) => s.date === today)
      .flatMap((s) => s.events)
      .filter((p) => {
        const live = p.live!;
        if (live.timeTBA) return true;
        const start = Date.parse(live.startsAt);
        const end = live.endsAt ? Date.parse(live.endsAt) : start + p.minutes * 60_000;
        if (end <= t) return false;
        // something with a real end time (an exhibit) is fine to join late; a show isn't
        return live.endEstimated ? start > t - 45 * 60_000 : true;
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
    return {
      date: bostonParts(now).date,
      total: this.events(now).length,
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
  if (env.TICKETMASTER_API_KEY) sources.push(ticketmasterSource(env.TICKETMASTER_API_KEY));
  if (env.SERPAPI_API_KEY) sources.push(googleEventsSource(env.SERPAPI_API_KEY, Number(env.GOOGLE_EVENTS_REFRESH_HOURS) || 12));
  return sources;
}
