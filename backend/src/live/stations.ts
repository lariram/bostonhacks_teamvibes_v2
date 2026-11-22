import { distanceKm } from './geo.js';

/** Main T stations in the neighborhoods we cover (approximate coordinates) */
const STATIONS: [string, number, number][] = [
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
];

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
