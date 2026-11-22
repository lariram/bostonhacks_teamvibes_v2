import { distanceKm } from './geo.js';

/** Main T stations in the neighborhoods we cover (approximate coordinates) */
export const STATIONS: [string, number, number][] = [
  ['Davis (Red)', 42.3967, -71.1218],
  ['Porter (Red)', 42.3884, -71.1191],
  ['Harvard (Red)', 42.3734, -71.1189],
  ['Central (Red)', 42.3655, -71.1037],
  ['Kendall/MIT (Red)', 42.3625, -71.0862],
  ['Charles/MGH (Red)', 42.3612, -71.0706],
  ['Park Street (Red/Green)', 42.3564, -71.0624],
  ['Downtown Crossing (Orange/Red)', 42.3555, -71.0602],
  ['South Station (Red/Silver)', 42.3523, -71.0552],
  ['Community College (Orange)', 42.3736, -71.0695],
  ['North Station (Orange/Green)', 42.3656, -71.0613],
  ['Haymarket (Orange/Green)', 42.363, -71.0583],
  ['State (Orange/Blue)', 42.3589, -71.0576],
  ['Chinatown (Orange)', 42.3524, -71.0628],
  ['Tufts Medical Center (Orange)', 42.3497, -71.0638],
  ['Back Bay (Orange)', 42.3474, -71.0757],
  ['Massachusetts Ave (Orange)', 42.3415, -71.0834],
  ['Ruggles (Orange)', 42.3364, -71.089],
  ['Lechmere (Green)', 42.3708, -71.0768],
  ['Union Square (Green)', 42.3777, -71.0947],
  ['Government Center (Green/Blue)', 42.3597, -71.0592],
  ['Boylston (Green)', 42.353, -71.0646],
  ['Arlington (Green)', 42.3518, -71.0705],
  ['Copley (Green)', 42.35, -71.0774],
  ['Hynes Convention Center (Green)', 42.3479, -71.0877],
  ['Prudential (Green E)', 42.3458, -71.0817],
  ['Symphony (Green E)', 42.3425, -71.0852],
  ['Northeastern (Green E)', 42.3401, -71.0889],
  ['Museum of Fine Arts (Green E)', 42.3374, -71.0957],
  ['Kenmore (Green)', 42.3489, -71.0951],
  ['Fenway (Green D)', 42.3452, -71.1043],
  ['BU Central (Green B)', 42.3503, -71.1067],
  ['Babcock Street (Green B)', 42.3516, -71.1215],
  ['Harvard Avenue (Green B)', 42.3503, -71.1311],
  ['Washington Street (Green B)', 42.3437, -71.1425],
  ['Chestnut Hill Ave (Green B)', 42.3381, -71.153],
  ['Cleveland Circle (Green C)', 42.3361, -71.1491],
  ['Boston College (Green B)', 42.3401, -71.1668],
  ['Aquarium (Blue)', 42.3598, -71.0517],
  ['Courthouse (Silver)', 42.3527, -71.0465],
  ['World Trade Center (Silver)', 42.3486, -71.0425],
  // ── beyond our 12 neighborhoods: subway, light rail and Silver Line (no Commuter Rail) ──
  ['Alewife (Red)', 42.3954, -71.1425],
  ['Broadway (Red)', 42.3426, -71.0569],
  ['Andrew (Red)', 42.3302, -71.057],
  ['JFK/UMass (Red)', 42.3207, -71.0524],
  ['Savin Hill (Red)', 42.3112, -71.0533],
  ['Fields Corner (Red)', 42.3, -71.0617],
  ['Ashmont (Red)', 42.2846, -71.0638],
  ['North Quincy (Red)', 42.2753, -71.03],
  ['Wollaston (Red)', 42.2665, -71.0203],
  ['Quincy Center (Red)', 42.2518, -71.0054],
  ['Quincy Adams (Red)', 42.2334, -71.0072],
  ['Braintree (Red)', 42.2079, -71.0012],
  ['Mattapan (Red/Mattapan Trolley)', 42.2677, -71.0924],
  ['Oak Grove (Orange)', 42.4367, -71.0711],
  ['Malden Center (Orange)', 42.4266, -71.0741],
  ['Wellington (Orange)', 42.4024, -71.077],
  ['Assembly (Orange)', 42.3925, -71.077],
  ['Sullivan Square (Orange)', 42.384, -71.077],
  ['Roxbury Crossing (Orange)', 42.3315, -71.0955],
  ['Jackson Square (Orange)', 42.3231, -71.0996],
  ['Stony Brook (Orange)', 42.3171, -71.1043],
  ['Green Street (Orange)', 42.3105, -71.1074],
  ['Forest Hills (Orange)', 42.3005, -71.1137],
  ['Bowdoin (Blue)', 42.3614, -71.062],
  ['Maverick (Blue)', 42.3691, -71.0395],
  ['Airport (Blue)', 42.3743, -71.0303],
  ['Wood Island (Blue)', 42.3796, -71.0229],
  ['Orient Heights (Blue)', 42.3869, -71.0047],
  ['Suffolk Downs (Blue)', 42.3906, -70.9971],
  ['Beachmont (Blue)', 42.3975, -70.9923],
  ['Revere Beach (Blue)', 42.4078, -70.9925],
  ['Wonderland (Blue)', 42.4135, -70.9916],
  ['Science Park/West End (Green)', 42.3664, -71.0677],
  ['East Somerville (Green)', 42.3796, -71.0868],
  ['Gilman Square (Green)', 42.3878, -71.096],
  ['Magoun Square (Green)', 42.3936, -71.1061],
  ['Ball Square (Green)', 42.3996, -71.111],
  ['Medford/Tufts (Green)', 42.4073, -71.117],
  ["Saint Mary's Street (Green C)", 42.3457, -71.1075],
  ['Coolidge Corner (Green C)', 42.342, -71.1211],
  ['Longwood (Green D)', 42.3415, -71.11],
  ['Brookline Village (Green D)', 42.3328, -71.1166],
  ['Brookline Hills (Green D)', 42.3313, -71.1267],
  ['Reservoir (Green D)', 42.335, -71.149],
  ['Chestnut Hill (Green D)', 42.3263, -71.1647],
  ['Newton Centre (Green D)', 42.3294, -71.1925],
  ['Newton Highlands (Green D)', 42.3223, -71.2056],
  ['Riverside (Green D)', 42.3373, -71.2526],
  ['Brigham Circle (Green E)', 42.3343, -71.1048],
  ['Heath Street (Green E)', 42.3288, -71.111],
  ['Nubian (Silver)', 42.3292, -71.0838],
  ['Chelsea (Silver)', 42.3975, -71.0414],
  ['Bellingham Square (Silver)', 42.392, -71.0334],
  ['Box District (Silver)', 42.3917, -71.0396],
  ['Eastern Avenue (Silver)', 42.3871, -71.0386],
  ['Silver Line Way (Silver)', 42.3474, -71.0398],
  ['Design Center (Silver)', 42.3443, -71.0377],
  ['Herald Street (Silver)', 42.3466, -71.0647],
  ['East Berkeley Street (Silver)', 42.3443, -71.0679],
  ['Union Park Street (Silver)', 42.3424, -71.0715],
  ['Newton Street (Silver)', 42.3394, -71.0749],
  ['Worcester Square (Silver)', 42.3374, -71.0768],
  ['Washington St & Mass Ave (Silver)', 42.3362, -71.0777],
  ['Lenox Street (Silver)', 42.3349, -71.0791],
  ['Melnea Cass Blvd (Silver)', 42.3319, -71.081],
  // Mattapan Trolley
  ['Cedar Grove (Mattapan Trolley)', 42.2797, -71.0605],
  ['Butler (Mattapan Trolley)', 42.2721, -71.0625],
  ['Milton (Mattapan Trolley)', 42.2701, -71.0674],
  ['Central Avenue (Mattapan Trolley)', 42.27, -71.0734],
  ['Valley Road (Mattapan Trolley)', 42.2683, -71.0813],
  ['Capen Street (Mattapan Trolley)', 42.2675, -71.0874],
  ['Shawmut (Red)', 42.2933, -71.0657],
  // Green Line surface stops (approximate positions)
  ['Blandford Street (Green B)', 42.3492, -71.1003],
  ['BU East (Green B)', 42.3496, -71.1038],
  ['Amory Street (Green B)', 42.3505, -71.114],
  ["Packard's Corner (Green B)", 42.3517, -71.1253],
  ['Griggs Street (Green B)', 42.3486, -71.1347],
  ['Allston Street (Green B)', 42.3487, -71.1373],
  ['Warren Street (Green B)', 42.3482, -71.1404],
  ['Sutherland Road (Green B)', 42.3417, -71.1462],
  ['Chiswick Road (Green B)', 42.3404, -71.151],
  ['South Street (Green B)', 42.3396, -71.1573],
  ['Hawes Street (Green C)', 42.3448, -71.1114],
  ['Kent Street (Green C)', 42.3446, -71.1142],
  ['Saint Paul Street (Green C)', 42.3433, -71.117],
  ['Summit Avenue (Green C)', 42.341, -71.1265],
  ['Brandon Hall (Green C)', 42.3401, -71.129],
  ['Washington Square (Green C)', 42.3392, -71.1352],
  ['Tappan Street (Green C)', 42.3383, -71.1386],
  ['Dean Road (Green C)', 42.3374, -71.1411],
  ['Englewood Avenue (Green C)', 42.3367, -71.1452],
  ['Beaconsfield (Green D)', 42.3354, -71.1408],
  ['Eliot (Green D)', 42.319, -71.2165],
  ['Waban (Green D)', 42.3259, -71.2306],
  ['Woodland (Green D)', 42.3329, -71.243],
  ['Longwood Medical Area (Green E)', 42.3357, -71.1004],
  ['Fenwood Road (Green E)', 42.3335, -71.1055],
  ['Mission Park (Green E)', 42.3331, -71.1095],
  ['Riverway (Green E)', 42.3317, -71.1115],
  ['Back of the Hill (Green E)', 42.33, -71.1112],
];

/**
 * Each line's stops in order, for drawing the T map (station names as above).
 * Branches are separate segments.
 */
export const ROUTES: { line: 'red' | 'orange' | 'blue' | 'green' | 'silver'; label: string; stops: string[] }[] = [
  { line: 'red', label: 'Red Line', stops: ['Alewife', 'Davis', 'Porter', 'Harvard', 'Central', 'Kendall/MIT', 'Charles/MGH', 'Park Street', 'Downtown Crossing', 'South Station', 'Broadway', 'Andrew', 'JFK/UMass', 'Savin Hill', 'Fields Corner', 'Shawmut', 'Ashmont', 'Cedar Grove', 'Butler', 'Milton', 'Central Avenue', 'Valley Road', 'Capen Street', 'Mattapan'] },
  { line: 'red', label: 'Red Line', stops: ['JFK/UMass', 'North Quincy', 'Wollaston', 'Quincy Center', 'Quincy Adams', 'Braintree'] },
  { line: 'orange', label: 'Orange Line', stops: ['Oak Grove', 'Malden Center', 'Wellington', 'Assembly', 'Sullivan Square', 'Community College', 'North Station', 'Haymarket', 'State', 'Downtown Crossing', 'Chinatown', 'Tufts Medical Center', 'Back Bay', 'Massachusetts Ave', 'Ruggles', 'Roxbury Crossing', 'Jackson Square', 'Stony Brook', 'Green Street', 'Forest Hills'] },
  { line: 'blue', label: 'Blue Line', stops: ['Wonderland', 'Revere Beach', 'Beachmont', 'Suffolk Downs', 'Orient Heights', 'Wood Island', 'Airport', 'Maverick', 'Aquarium', 'State', 'Government Center', 'Bowdoin'] },
  { line: 'green', label: 'Green Line', stops: ['Medford/Tufts', 'Ball Square', 'Magoun Square', 'Gilman Square', 'East Somerville', 'Lechmere', 'Science Park/West End', 'North Station', 'Haymarket', 'Government Center', 'Park Street', 'Boylston', 'Arlington', 'Copley', 'Hynes Convention Center', 'Kenmore'] },
  { line: 'green', label: 'Green Line', stops: ['Lechmere', 'Union Square'] },
  { line: 'green', label: 'Green Line', stops: ['Kenmore', 'Blandford Street', 'BU East', 'BU Central', 'Amory Street', 'Babcock Street', "Packard's Corner", 'Harvard Avenue', 'Griggs Street', 'Allston Street', 'Warren Street', 'Washington Street', 'Sutherland Road', 'Chiswick Road', 'Chestnut Hill Ave', 'South Street', 'Boston College'] },
  { line: 'green', label: 'Green Line', stops: ['Kenmore', "Saint Mary's Street", 'Hawes Street', 'Kent Street', 'Saint Paul Street', 'Coolidge Corner', 'Summit Avenue', 'Brandon Hall', 'Washington Square', 'Tappan Street', 'Dean Road', 'Englewood Avenue', 'Cleveland Circle'] },
  { line: 'green', label: 'Green Line', stops: ['Kenmore', 'Fenway', 'Longwood', 'Brookline Village', 'Brookline Hills', 'Beaconsfield', 'Reservoir', 'Chestnut Hill', 'Newton Centre', 'Newton Highlands', 'Eliot', 'Waban', 'Woodland', 'Riverside'] },
  { line: 'green', label: 'Green Line', stops: ['Copley', 'Prudential', 'Symphony', 'Northeastern', 'Museum of Fine Arts', 'Longwood Medical Area', 'Brigham Circle', 'Fenwood Road', 'Mission Park', 'Riverway', 'Back of the Hill', 'Heath Street'] },
  { line: 'silver', label: 'Silver Line', stops: ['South Station', 'Courthouse', 'World Trade Center', 'Silver Line Way', 'Design Center'] },
  { line: 'silver', label: 'Silver Line', stops: ['Silver Line Way', 'Airport', 'Eastern Avenue', 'Box District', 'Bellingham Square', 'Chelsea'] },
  { line: 'silver', label: 'Silver Line', stops: ['Chinatown', 'Tufts Medical Center', 'Herald Street', 'East Berkeley Street', 'Union Park Street', 'Newton Street', 'Worcester Square', 'Washington St & Mass Ave', 'Lenox Street', 'Melnea Cass Blvd', 'Nubian'] },
];

/** "Harvard (Red)" → "Harvard" */
export const stationShortName = (name: string) => name.replace(/\s*\(.*\)$/, '');

/** Within ~12 minutes' walk of a subway, light rail or Silver Line station? */
export function transitStation(lat: number, lng: number, maxKm = 1): { name: string; km: number } | null {
  let best: { name: string; km: number } | null = null;
  for (const [name, sLat, sLng] of STATIONS) {
    const km = distanceKm([lat, lng], [sLat, sLng]);
    if (km <= maxKm && (!best || km < best.km)) best = { name, km };
  }
  return best;
}

/** "Kendall/MIT (Red) · 6 min walk", or null if nothing's within ~15 minutes on foot */
export function nearestStop(lat: number, lng: number): string | null {
  let best: [string, number] | null = null;
  for (const [name, sLat, sLng] of STATIONS) {
    const km = distanceKm([lat, lng], [sLat, sLng]);
    if (!best || km < best[1]) best = [name, km];
  }
  if (!best || best[1] > 1.2) return null;
  const mins = Math.max(1, Math.round((best[1] * 1000) / 80)); // ~80 m per minute
  return `${best[0]} · ${mins} min walk`;
}

/** The closest station with its coordinates (for drawing it on the map) */
export function nearestStation(lat: number, lng: number, maxKm = 1.5): { name: string; lat: number; lng: number; km: number } | null {
  let best: { name: string; lat: number; lng: number; km: number } | null = null;
  for (const [name, sLat, sLng] of STATIONS) {
    const km = distanceKm([lat, lng], [sLat, sLng]);
    if (km <= maxKm && (!best || km < best.km)) best = { name, lat: sLat, lng: sLng, km };
  }
  return best;
}

export type TLine = (typeof ROUTES)[number]['line'];

/**
 * "T stop bingo": every rapid-transit stop, and which ones you've checked off.
 * A stop counts once you've completed a plan at a place within ~1 km of it
 * (its nearest station).
 */
export function tStopBingo(places: { lat: number; lng: number }[]) {
  const visited = new Set<string>();
  for (const p of places) {
    const st = nearestStation(p.lat, p.lng, 1);
    if (st) visited.add(stationShortName(st.name));
  }
  const linesOf = new Map<string, Set<TLine>>();
  for (const r of ROUTES) for (const s of r.stops) (linesOf.get(s) ?? linesOf.set(s, new Set()).get(s)!).add(r.line);
  const stops = STATIONS.map(([full, lat, lng]) => {
    const name = stationShortName(full);
    return { name, lines: [...(linesOf.get(name) ?? [])], lat, lng, visited: visited.has(name) };
  });
  const LABELS: Record<TLine, string> = { red: 'Red', orange: 'Orange', blue: 'Blue', green: 'Green', silver: 'Silver' };
  const byLine = (Object.keys(LABELS) as TLine[]).map((line) => {
    const on = stops.filter((s) => s.lines.includes(line));
    return { line, label: LABELS[line], visited: on.filter((s) => s.visited).length, total: on.length };
  });
  return {
    stops,
    routes: ROUTES.map((r) => ({ line: r.line, stops: r.stops })),
    byLine,
    visited: visited.size,
    total: stops.length,
  };
}
