// "Surprise me" agendas: a random solo day (or week) of stops that stay close
// together. The route can stay in one neighborhood or slowly wander into the
// next one over, the way a good walk does.

import { NEIGHBORHOOD_BY_ID, NEIGHBORHOODS, priceRank } from './data/meta.js';
import { scheduleFor, visitWindow } from './hours.js';
import { bostonParts, bostonWallTime } from './live/time.js';
import { distanceKm } from './live/geo.js';
import { estimateTravel, type Travel } from './travel.js';
import type { NeighborhoodId, Place, PlaceType, PriceTier, User } from './types.js';

export type AgendaSpan = 'day' | 'week';
export type AgendaPace = 'stay' | 'wander';

export interface AgendaRequest {
  span: AgendaSpan;
  /** 'stay' keeps every stop in one neighborhood; 'wander' may drift to the next one over */
  pace: AgendaPace;
  start?: NeighborhoodId;
  price: PriceTier;
  /** Boston date to start on (YYYY-MM-DD); defaults to today, or tomorrow if it's late */
  date?: string;
}

export interface AgendaStop {
  place: Place;
  start: string;
  end: string;
  /** From the previous stop (null for the first one) */
  travel: Travel | null;
}
export interface AgendaDay {
  date: string;
  stops: AgendaStop[];
  /** The neighborhoods the day passes through, in order */
  route: NeighborhoodId[];
}

/** What a day looks like: a slot type and when it starts (hour, minute) */
type Slot = { types: PlaceType[]; at: [number, number] };
const FULL_DAY: Slot[] = [
  { types: ['activity'], at: [10, 30] },
  { types: ['food'], at: [12, 30] },
  { types: ['event', 'activity'], at: [14, 30] },
  { types: ['food'], at: [18, 0] },
  { types: ['event', 'activity'], at: [19, 30] },
];
const WEEKNIGHT: Slot[] = [
  { types: ['event', 'activity'], at: [17, 30] },
  { types: ['food'], at: [19, 0] },
];
const WEEKEND: Slot[] = [
  { types: ['activity'], at: [11, 0] },
  { types: ['food'], at: [13, 0] },
  { types: ['event', 'activity'], at: [15, 0] },
];

const DAY_MS = 86_400_000;
/** How far one stop can be from the last: a short walk */
const NEAR_KM = 1.3;
/** Chance that a 'wander' agenda moves on to the next neighborhood at each stop */
const DRIFT = 0.35;

interface Ctx {
  user: User;
  places: Place[];
  random: () => number;
  now: Date;
}

const point = (p: Place): [number, number] => [p.lat, p.lng];

function affinity(user: User, p: Place): number {
  const prefs = new Set([...user.preferences.food, ...user.preferences.event, ...user.preferences.activity]);
  return p.tags.reduce((s, t) => s + (user.tagWeights[t] ?? 0) + (prefs.has(t) ? 0.3 : 0), 0);
}

/** Weighted random pick */
function pick<T>(items: { item: T; w: number }[], random: () => number): T | null {
  const total = items.reduce((a, x) => a + x.w, 0);
  if (!items.length || total <= 0) return null;
  let r = random() * total;
  for (const x of items) if ((r -= x.w) <= 0) return x.item;
  return items[items.length - 1].item;
}

/** Can you do this place starting around `arrive`? Returns when you'd start and how long you'd stay. */
function fits(p: Place, arrive: Date): { start: Date; minutes: number } | null {
  const want = Math.min(p.minutes, p.type === 'food' ? 75 : 120);
  if (p.live && !p.live.openHours) {
    if (p.live.timeTBA) return null;
    const starts = new Date(p.live.startsAt);
    // a show you can make, without waiting around for more than an hour
    if (starts < arrive || starts.getTime() - arrive.getTime() > 75 * 60_000) return null;
    const end = p.live.endsAt ? new Date(p.live.endsAt) : new Date(starts.getTime() + p.minutes * 60_000);
    return { start: starts, minutes: Math.max(30, Math.min(180, (end.getTime() - starts.getTime()) / 60_000)) };
  }
  if (p.type === 'event' && !p.live) return null; // "events" are real, dated listings only
  const hours = p.openingHours ?? scheduleFor(p.id);
  if (!hours) return { start: arrive, minutes: want };
  const win = visitWindow(hours.schedule, arrive, new Date(arrive.getTime() + 30 * 60_000));
  if (!win) return null;
  const left = (win.until.getTime() - win.from.getTime()) / 60_000;
  if (left < Math.min(want, 45)) return null;
  return { start: win.from, minutes: Math.min(want, left) };
}

function inSeason(p: Place, d: Date) {
  const month = Number(bostonParts(d).date.slice(5, 7));
  return !p.months || p.months.includes(month);
}

function planDay(date: string, slots: Slot[], startHood: NeighborhoodId, req: AgendaRequest, ctx: Ctx, used: Set<string>): AgendaDay {
  const stops: AgendaStop[] = [];
  const route: NeighborhoodId[] = [startHood];
  let hood = startHood;
  let at: [number, number] | null = null; // where you are
  let free = new Date(0); // when you're free again
  const budget = priceRank(req.price);

  for (const [i, slot] of slots.entries()) {
    let cursor = bostonWallTime(date, slot.at[0], slot.at[1]);
    if (cursor < free) cursor = free;
    if (cursor < ctx.now) cursor = new Date(Math.ceil(ctx.now.getTime() / (30 * 60_000)) * 30 * 60_000);
    if (bostonParts(cursor).date !== date || bostonParts(cursor).hour >= 23) break;

    // maybe wander on to the next neighborhood over (never on the first stop)
    let area: NeighborhoodId[] = [hood];
    if (req.pace === 'wander' && i > 0 && ctx.random() < DRIFT) {
      const next = NEIGHBORHOOD_BY_ID[hood].near.filter((n) => !route.includes(n));
      if (next.length) area = [next[Math.floor(ctx.random() * next.length)]];
    }

    const choose = (maxKm: number, areas: NeighborhoodId[]) => {
      const options: { item: { p: Place; start: Date; minutes: number; travel: Travel | null }; w: number }[] = [];
      for (const p of ctx.places) {
        if (used.has(p.id) || !slot.types.includes(p.type) || !areas.includes(p.neighborhood)) continue;
        if (priceRank(p.price) > budget || !inSeason(p, cursor)) continue;
        const km = at ? distanceKm(at, point(p)) : 0;
        if (km > maxKm) continue;
        const travel = at ? estimateTravel(at, point(p)) : null;
        const arrive = new Date(cursor.getTime() + (travel?.minutes ?? 0) * 60_000);
        const ok = fits(p, arrive);
        if (!ok) continue;
        // close by, matches your taste, and a little luck; real events get a nudge
        const w = Math.exp(-km / 0.7) * Math.exp(0.8 * affinity(ctx.user, p)) * (p.live ? 1.4 : 1) * (0.4 + ctx.random());
        options.push({ item: { p, start: ok.start, minutes: ok.minutes, travel }, w });
      }
      return pick(options, ctx.random);
    };

    // nearby first; then a bit further in the same area; then (wandering only) the next area over
    const got =
      choose(NEAR_KM, area) ??
      (area[0] !== hood ? choose(NEAR_KM, [hood]) : null) ??
      choose(NEAR_KM * 1.6, [hood, ...area]) ??
      (req.pace === 'wander' ? choose(NEAR_KM * 2, [hood, ...NEIGHBORHOOD_BY_ID[hood].near]) : null);
    if (!got) continue;
    used.add(got.p.id);
    const end = new Date(got.start.getTime() + got.minutes * 60_000);
    stops.push({ place: got.p, start: got.start.toISOString(), end: end.toISOString(), travel: got.travel });
    at = point(got.p);
    free = end;
    if (got.p.neighborhood !== hood) {
      hood = got.p.neighborhood;
      route.push(hood);
    }
  }
  return { date, stops, route };
}

export function generateAgenda(req: AgendaRequest, ctx: Ctx): { days: AgendaDay[] } {
  const places = ctx.places.filter((p) => p.neighborhood !== 'greater');
  const c = { ...ctx, places };
  const today = bostonParts(ctx.now);
  const startDate = req.date ?? (today.hour >= 20 ? bostonParts(new Date(ctx.now.getTime() + DAY_MS)).date : today.date);
  let hood: NeighborhoodId = req.start ?? NEIGHBORHOODS[Math.floor(ctx.random() * NEIGHBORHOODS.length)].id;
  const used = new Set<string>();
  const days: AgendaDay[] = [];
  const count = req.span === 'week' ? 7 : 1;
  for (let i = 0; i < count; i++) {
    const date = bostonParts(new Date(bostonWallTime(startDate, 12).getTime() + i * DAY_MS)).date;
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    const slots = req.span === 'day' ? FULL_DAY : weekday === 0 || weekday === 6 ? WEEKEND : WEEKNIGHT;
    const day = planDay(date, slots, hood, req, c, used);
    days.push(day);
    // the next day picks up where this one ended (wander), or back home (stay)
    if (req.pace === 'wander') hood = day.route[day.route.length - 1];
  }
  return { days };
}
