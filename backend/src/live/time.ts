import { timeOfDayForHour, TIMES_OF_DAY } from '../data/meta.js';
import type { TimeOfDay } from '../types.js';

/** Everything "today" means Boston's today, whatever timezone the server runs in. */
export const BOSTON_TZ = 'America/New_York';

const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: BOSTON_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function bostonParts(d: Date): { date: string; hour: number; minute: number } {
  const p = Object.fromEntries(partsFmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24, minute: Number(p.minute) };
}

/** Boston's UTC offset in minutes at an instant (-300 in winter, -240 in summer) */
export function bostonOffsetMinutes(d: Date): number {
  const name =
    new Intl.DateTimeFormat('en-US', { timeZone: BOSTON_TZ, timeZoneName: 'shortOffset' })
      .formatToParts(d)
      .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT-5';
  const m = name.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/);
  if (!m) return -300;
  const h = Number(m[1]);
  return h * 60 + Math.sign(h) * Number(m[2] ?? 0);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** A Boston wall-clock time ("2026-11-22", 19, 30) as a real instant. DST-safe. */
export function bostonWallTime(date: string, hour: number, minute = 0): Date {
  const asUtc = new Date(`${date}T${pad(hour)}:${pad(minute)}:00Z`);
  const off = bostonOffsetMinutes(asUtc);
  const guess = new Date(asUtc.getTime() - off * 60_000);
  const off2 = bostonOffsetMinutes(guess);
  return off2 === off ? guess : new Date(asUtc.getTime() - off2 * 60_000);
}

/** Today in Boston: date string plus the instants where it starts and ends */
export function bostonDay(now: Date): { date: string; start: Date; end: Date } {
  const { date } = bostonParts(now);
  return { date, start: bostonWallTime(date, 0, 0), end: new Date(bostonWallTime(date, 23, 59).getTime() + 60_000) };
}

export function timeOfDayAt(d: Date): TimeOfDay {
  return timeOfDayForHour(bostonParts(d).hour);
}

/** Every time-of-day bucket an event overlaps, in order */
export function timesForRange(start: Date, end?: Date): TimeOfDay[] {
  const hit = new Set<TimeOfDay>([timeOfDayAt(start)]);
  if (end) for (let t = start.getTime(); t < end.getTime(); t += 30 * 60_000) hit.add(timeOfDayAt(new Date(t)));
  return TIMES_OF_DAY.map((t) => t.id).filter((t) => hit.has(t));
}

const clockFmt = new Intl.DateTimeFormat('en-US', { timeZone: BOSTON_TZ, hour: 'numeric', minute: '2-digit' });
/** "7:30 PM" in Boston time */
export function formatBostonTime(d: Date): string {
  return clockFmt.format(d).replace(':00', '');
}

/** Parse a clock time like "7:30 PM", "12 PM", "19:30" → [hour, minute] */
export function parseClock(text: string): [number, number] | null {
  const m = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  const mer = m[3]?.toLowerCase().replace(/\./g, '');
  if (!mer && !m[2]) return null; // a bare number isn't a time
  if (mer === 'pm' && h < 12) h += 12;
  if (mer === 'am' && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return [h, min];
}
