import { HOURS } from './data/hours.js';
import { bostonParts, bostonWallTime } from './live/time.js';

/**
 * Weekly opening hours: for each weekday (0 = Sunday … 6 = Saturday), a list of
 * [open, close] in minutes after midnight. close may pass 1440 (past midnight).
 */
export type Schedule = [number, number][][];

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/** Parse "Mo-Th,Su 11:00-23:30; Fr,Sa 11:00-24:30" (a subset of OSM opening_hours) */
export function parseHours(spec: string): Schedule {
  const week: Schedule = [[], [], [], [], [], [], []];
  for (const rule of spec.split(';').map((r) => r.trim()).filter(Boolean)) {
    const m = rule.match(/^([A-Za-z,\-]+)\s+(.+)$/);
    if (!m) continue;
    const days = new Set<number>();
    for (const part of m[1].split(',')) {
      const [a, b] = part.split('-').map((d) => DAYS.indexOf(d.trim()));
      if (a < 0) continue;
      if (b === undefined || b < 0) days.add(a);
      else for (let d = a; ; d = (d + 1) % 7) {
        days.add(d);
        if (d === b) break;
      }
    }
    for (const range of m[2].split(',')) {
      const t = range.trim().match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
      if (!t) continue;
      const open = Number(t[1]) * 60 + Number(t[2]);
      let close = Number(t[3]) * 60 + Number(t[4]);
      if (close <= open) close += 1440;
      for (const d of days) week[d].push([open, close]);
    }
  }
  return week;
}

const weekdayFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' });
const bostonWeekday = (d: Date) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekdayFmt.format(d));

/** All opening intervals as real instants, for the Boston day of `at` and the day before (late nights) */
export function intervalsAround(schedule: Schedule, at: Date): [Date, Date][] {
  const out: [Date, Date][] = [];
  for (const offset of [-1, 0]) {
    const day = new Date(at.getTime() + offset * 24 * 60 * 60 * 1000);
    const date = bostonParts(day).date;
    const midnight = bostonWallTime(date, 0, 0).getTime();
    for (const [o, c] of schedule[bostonWeekday(day)] ?? []) {
      out.push([new Date(midnight + o * 60_000), new Date(midnight + c * 60_000)]);
    }
  }
  return out.sort((a, b) => a[0].getTime() - b[0].getTime());
}

/**
 * Can you visit between `arrive` and `latest` (the end of your window)?
 * Returns the stretch you'd actually have there, or null if it's closed.
 */
export function visitWindow(schedule: Schedule, arrive: Date, latest: Date): { from: Date; until: Date } | null {
  for (const [open, close] of intervalsAround(schedule, arrive)) {
    if (close <= arrive || open >= latest) continue;
    return { from: open > arrive ? open : arrive, until: close };
  }
  return null;
}

export function scheduleFor(id: string, google?: Schedule): { schedule: Schedule; approx: boolean } | null {
  if (google) return { schedule: google, approx: false };
  const spec = HOURS[id];
  return spec ? { schedule: parseHours(spec), approx: true } : null;
}

/** Google Places regularOpeningHours.periods → Schedule */
export function scheduleFromGoogle(periods: { open?: { day: number; hour: number; minute?: number }; close?: { day: number; hour: number; minute?: number } }[]): Schedule {
  const week: Schedule = [[], [], [], [], [], [], []];
  for (const p of periods) {
    if (!p.open) continue;
    const open = p.open.hour * 60 + (p.open.minute ?? 0);
    if (!p.close) {
      week[p.open.day].push([0, 1440]); // open 24 hours
      continue;
    }
    let close = p.close.hour * 60 + (p.close.minute ?? 0) + ((p.close.day - p.open.day + 7) % 7) * 1440;
    if (close <= open) close += 1440;
    week[p.open.day].push([open, close]);
  }
  return week;
}
