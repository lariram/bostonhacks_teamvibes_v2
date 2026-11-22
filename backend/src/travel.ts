import { distanceKm } from './live/geo.js';
import { STATIONS } from './live/stations.js';

/**
 * Rough door-to-door time on foot or by T. No API needed. It's an estimate,
 * and the app says so. Model:
 *   walk:  straight-line distance × 1.3 (streets aren't straight) at 80 m/min
 *   T:     walk to the nearest station + ~6 min wait + ride at ~2.6 min/km
 *          + 5 min if you'd have to change lines + walk from the station
 * We take whichever is faster.
 */
export interface Travel {
  minutes: number;
  mode: 'walk' | 'T';
  /** "~18 min by T (Harvard → Park Street)" */
  summary: string;
}

const WALK_M_PER_MIN = 80;
const DETOUR = 1.3;
const walkMin = (km: number) => (km * 1000 * DETOUR) / WALK_M_PER_MIN;
const lines = (name: string) => new Set((name.match(/\(([^)]+)\)/)?.[1] ?? '').split('/').map((l) => l.trim().split(' ')[0]));

function nearest(lat: number, lng: number) {
  let best = { name: STATIONS[0][0], lat: STATIONS[0][1], lng: STATIONS[0][2], km: Infinity };
  for (const [name, sLat, sLng] of STATIONS) {
    const km = distanceKm([lat, lng], [sLat, sLng]);
    if (km < best.km) best = { name, lat: sLat, lng: sLng, km };
  }
  return best;
}

export function estimateTravel(from: [number, number], to: [number, number]): Travel {
  const km = distanceKm(from, to);
  const walk = walkMin(km);
  const a = nearest(from[0], from[1]);
  const b = nearest(to[0], to[1]);
  let transit = Infinity;
  if (a.name !== b.name) {
    const shared = [...lines(a.name)].some((l) => lines(b.name).has(l));
    transit = walkMin(a.km) + 6 + distanceKm([a.lat, a.lng], [b.lat, b.lng]) * 2.6 + (shared ? 0 : 5) + walkMin(b.km);
  }
  const short = (n: string) => n.replace(/\s*\(.*\)/, '');
  if (walk <= transit || km < 0.8) {
    const m = Math.max(2, Math.round(walk));
    return { minutes: m, mode: 'walk', summary: `~${m} min walk` };
  }
  const m = Math.round(transit);
  return { minutes: m, mode: 'T', summary: `~${m} min by T (${short(a.name)} → ${short(b.name)})` };
}
