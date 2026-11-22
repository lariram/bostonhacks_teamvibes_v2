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

/** "Today · 7:30 PM" */
export function liveWhen(live: LiveInfo): string {
  return live.timeTBA ? 'Today · time TBA' : `Today · ${bostonTime(live.startsAt)}`;
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
