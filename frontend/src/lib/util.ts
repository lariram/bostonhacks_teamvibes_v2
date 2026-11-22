import type { LiveInfo, TimeOfDay } from './types';

export function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return 'just now';
  const m = s / 60;
  if (m < 60) return `${Math.floor(m)}m`;
  const h = m / 60;
  if (h < 24) return `${Math.floor(h)}h`;
  const d = h / 24;
  if (d < 7) return `${Math.floor(d)}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = min / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(1)} hr${h > 1 ? 's' : ''}`;
}

export function currentTimeOfDay(d = new Date()): TimeOfDay {
  const h = d.getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 22) return 'evening';
  return 'late';
}

export const TIME_LABEL: Record<TimeOfDay, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  late: 'Late night',
};

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

export function mapsSearchUrl(name: string, address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, ${address}`)}`;
}

export function transitDirectionsUrl(name: string, address: string) {
  return `https://www.google.com/maps/dir/?api=1&travelmode=transit&destination=${encodeURIComponent(`${name}, ${address}`)}`;
}

/** OpenStreetMap embed centered on a point. We draw our own pin on top, at the center. */
export function osmEmbedUrl(lat: number, lng: number) {
  const dx = 0.006;
  const dy = 0.0035;
  const bbox = [lng - dx, lat - dy, lng + dx, lat + dy].map((n) => n.toFixed(5)).join(',');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik`;
}

/** Event times are always shown in Boston time */
const bostonClock = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });
export function bostonTime(iso: string): string {
  return bostonClock.format(new Date(iso)).replace(':00', '');
}

const bostonDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
const bostonDay = (d: Date) => bostonDate.format(d);
const dayFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' });

/** "Today", "Tomorrow", or "Sat, Dec 5" (Boston time) */
export function dayName(d: Date, now = new Date()): string {
  const day = bostonDay(d);
  if (day === bostonDay(now)) return 'Today';
  if (day === bostonDay(new Date(now.getTime() + 24 * 60 * 60 * 1000))) return 'Tomorrow';
  return dayFmt.format(d);
}

/** "Today · 7:30 PM", "Tomorrow · 8 PM", "Open now · until 5 PM" */
export function liveWhen(live: LiveInfo): string {
  const start = new Date(live.startsAt);
  if (live.openHours) {
    const open = start.getTime() <= Date.now();
    return open ? `Open now${live.endsAt && !live.endEstimated ? ` · until ${bostonTime(live.endsAt)}` : ''}` : `${dayName(start)} · from ${bostonTime(live.startsAt)}`;
  }
  return live.timeTBA ? `${dayName(start)} · time TBA` : `${dayName(start)} · ${bostonTime(live.startsAt)}`;
}

/** "7:30 – 10 PM" when we know the real end, otherwise just the start */
export function liveRange(live: LiveInfo): string {
  if (live.timeTBA) return 'Time TBA';
  const start = bostonTime(live.startsAt);
  if (!live.endsAt || live.endEstimated) return start;
  const end = bostonTime(live.endsAt);
  const [s, sm] = [start.replace(/ (AM|PM)$/, ''), start.slice(-2)];
  return sm === end.slice(-2) ? `${s} – ${end}` : `${start} – ${end}`;
}

/** 30 → "30 min", 90 → "1.5 hrs" */
export function durationLabel(min: number): string {
  if (min < 60) return `${min} min`;
  const h = min / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(1)} hr${h === 1 ? '' : 's'}`;
}

const localClock = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
export const clock = (d: Date) => localClock.format(d);

/** The next `count` days, starting today (local midnight) */
export function upcomingDays(count: number, now = new Date()): Date[] {
  const base = new Date(now);
  base.setHours(0, 0, 0, 0);
  return Array.from({ length: count }, (_, i) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + i));
}

/**
 * Start times in 30-minute steps for a given day: from the next half hour if
 * it's today, otherwise 8:00 AM, through 11:30 PM.
 */
export function startSlots(day: Date = new Date(), now = new Date()): Date[] {
  const isToday = day.toDateString() === now.toDateString();
  const first = new Date(isToday ? now : day);
  first.setSeconds(0, 0);
  if (isToday) first.setMinutes(first.getMinutes() < 30 ? 30 : 60);
  else first.setHours(8, 0, 0, 0);
  const last = new Date(day);
  last.setHours(23, 30, 0, 0);
  const out: Date[] = [];
  for (let t = first; t <= last; t = new Date(t.getTime() + 30 * 60_000)) out.push(t);
  return out;
}

/** "7:30 – 9:30 PM" */
export function windowLabel(start: Date, minutes: number): string {
  const end = new Date(start.getTime() + minutes * 60_000);
  const a = clock(start);
  const b = clock(end);
  return a.slice(-2) === b.slice(-2) ? `${a.slice(0, -3)} – ${b}` : `${a} – ${b}`;
}

/** "Add to Google Calendar" link (no sign-in or API key needed) */
export function googleCalendarUrl(e: { title: string; start: Date; end: Date; location?: string; details?: string }): string {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates: `${fmt(e.start)}/${fmt(e.end)}`,
    details: e.details ?? '',
    location: e.location ?? '',
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

/**
 * Your current location, if you allow it (asked once; remembered for 10 minutes).
 * Resolves to undefined if denied, unavailable or slow, so searches never stall.
 */
export function currentLocation(timeoutMs = 5000): Promise<{ lat: number; lng: number } | undefined> {
  if (!('geolocation' in navigator)) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const done = (v?: { lat: number; lng: number }) => resolve(v);
    const timer = setTimeout(() => done(undefined), timeoutMs + 500);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        clearTimeout(timer);
        done({ lat: Number(p.coords.latitude.toFixed(4)), lng: Number(p.coords.longitude.toFixed(4)) }); // ~10 m is plenty
      },
      () => {
        clearTimeout(timer);
        done(undefined);
      },
      { timeout: timeoutMs, maximumAge: 10 * 60 * 1000, enableHighAccuracy: false },
    );
  });
}
