import type { NeighborhoodId } from '../types.js';

/**
 * A few anchor points per neighborhood. An event belongs to the neighborhood
 * of its nearest anchor, if one is close enough. Anything farther out (say,
 * Gillette Stadium) isn't "around Boston" for our purposes and is skipped.
 */
const ANCHORS: Record<NeighborhoodId, [number, number][]> = {
  downtown: [[42.3555, -71.0605], [42.3601, -71.0589], [42.3588, -71.0538], [42.3662, -71.0621], [42.3522, -71.0552]],
  theater: [[42.3513, -71.0644]],
  chinatown: [[42.3505, -71.0605]],
  northend: [[42.3647, -71.0542]],
  backbay: [[42.3503, -71.079], [42.3472, -71.085], [42.3554, -71.07], [42.343, -71.073]],
  fenway: [[42.3467, -71.0972], [42.3394, -71.094], [42.3398, -71.0892], [42.3428, -71.0857]],
  seaport: [[42.3519, -71.0446], [42.3466, -71.04]],
  charlestown: [[42.3782, -71.0602], [42.3725, -71.0566]],
  cambridge: [[42.3736, -71.119], [42.3655, -71.1037], [42.3625, -71.0862], [42.3601, -71.0942], [42.3734, -71.1006], [42.3884, -71.1191]],
  somerville: [[42.3967, -71.1223], [42.3796, -71.095], [42.3925, -71.077], [42.387, -71.099]],
  allston: [[42.353, -71.1323], [42.3536, -71.1366], [42.3521, -71.1178], [42.3668, -71.1257], [42.3505, -71.1054]],
  brighton: [[42.3487, -71.1527], [42.338, -71.153], [42.3355, -71.1685]],
};

export function distanceKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function neighborhoodForPoint(lat: number, lng: number, maxKm = 1.6): NeighborhoodId | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  let best: NeighborhoodId | null = null;
  let bestKm = maxKm;
  for (const [id, points] of Object.entries(ANCHORS) as [NeighborhoodId, [number, number][]][]) {
    for (const p of points) {
      const km = distanceKm([lat, lng], p);
      if (km < bestKm) {
        bestKm = km;
        best = id;
      }
    }
  }
  return best;
}

const ZIPS: Record<string, NeighborhoodId> = {
  '02108': 'downtown', '02109': 'downtown', '02110': 'downtown', '02114': 'downtown', '02203': 'downtown',
  '02111': 'chinatown', '02113': 'northend', '02116': 'backbay', '02118': 'backbay', '02199': 'backbay',
  '02115': 'fenway', '02215': 'fenway', '02210': 'seaport', '02127': 'seaport', '02129': 'charlestown',
  '02134': 'allston', '02163': 'allston', '02135': 'brighton', '02467': 'brighton',
  '02138': 'cambridge', '02139': 'cambridge', '02140': 'cambridge', '02141': 'cambridge', '02142': 'cambridge',
  '02143': 'somerville', '02144': 'somerville', '02145': 'somerville',
};

const TEXT_HINTS: [RegExp, NeighborhoodId][] = [
  [/\bcambridge\b/i, 'cambridge'],
  [/\bsomerville\b/i, 'somerville'],
  [/\ballston\b/i, 'allston'],
  [/\bbrighton\b/i, 'brighton'],
  [/\bcharlestown\b/i, 'charlestown'],
  [/\b(seaport|south boston|fort point)\b/i, 'seaport'],
  [/\b(fenway|kenmore|longwood)\b/i, 'fenway'],
  [/\bback bay\b/i, 'backbay'],
  [/\bchinatown\b/i, 'chinatown'],
  [/\bnorth end\b/i, 'northend'],
  [/\btheat(er|re) district\b/i, 'theater'],
];

/** "52 Church St, Cambridge, MA 02138" → cambridge. ZIP first, then place names. */
export function neighborhoodForAddress(address: string): NeighborhoodId | null {
  const zip = address.match(/\b(0\d{4})(?:-\d{4})?\b/)?.[1];
  if (zip) return ZIPS[zip] ?? null;
  for (const [re, id] of TEXT_HINTS) if (re.test(address)) return id;
  return null;
}

/** A representative point, for listings that only tell us the neighborhood */
export function neighborhoodCenter(id: NeighborhoodId): [number, number] {
  return ANCHORS[id][0];
}

/** Closest T stops per neighborhood, for listings without one (approximate) */
export const APPROX_T_STOP: Record<NeighborhoodId, string> = {
  downtown: 'Park Street (Red/Green) or Downtown Crossing (Orange)',
  theater: 'Boylston (Green) or Tufts Medical Center (Orange)',
  chinatown: 'Chinatown (Orange) or Silver Line',
  northend: 'Haymarket (Orange/Green)',
  backbay: 'Copley (Green) or Back Bay (Orange)',
  fenway: 'Kenmore (Green) or Northeastern (Green E)',
  seaport: 'Silver Line: Courthouse',
  charlestown: 'Community College (Orange)',
  cambridge: 'Harvard, Central or Kendall/MIT (Red)',
  somerville: 'Davis (Red) or Union Square (Green)',
  allston: 'Harvard Ave or BU (Green B)',
  brighton: 'Boston College (Green B)',
};
