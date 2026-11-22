// Schematic layout of the T for the stop bingo, in the spirit of the official
// rapid transit diagram: straight lines at 0/45/90 degrees, not to scale.
// Coordinates are in an abstract ~1900×1700 space.
//
// A route is a list of stops and [x, y] waypoints. A stop with a position in
// ANCHORS is pinned there; the stops between two pinned stops are spaced evenly
// along the path between them (through any waypoints).

import type { TLine } from '../lib/types';

export type Pt = [number, number];

/** Where a label sits: left/right/top/bottom, or rotated 45° up-right / down-right / down-left */
export type Side = 'l' | 'r' | 't' | 'b' | 'ur' | 'dr' | 'dl';

const ANCHORS: Record<string, Pt> = {
  // Red
  Alewife: [698, 257],
  Porter: [832, 391],
  Harvard: [890, 449],
  'Kendall/MIT': [1018, 577],
  'Park Street': [1155, 713],
  'Downtown Crossing': [1232, 790],
  'South Station': [1305, 863],
  Broadway: [1365, 1016],
  'JFK/UMass': [1365, 1178],
  'Savin Hill': [1287, 1372],
  Ashmont: [1287, 1470],
  'Cedar Grove': [1287, 1530],
  Butler: [1250, 1580],
  Mattapan: [1092, 1580],
  'North Quincy': [1480, 1383],
  'Quincy Center': [1580, 1483],
  'Quincy Adams': [1620, 1545],
  Braintree: [1620, 1615],
  // Orange
  'Oak Grove': [1292, 135],
  'Community College': [1292, 385],
  'North Station@orange': [1292, 528],
  'Haymarket@orange': [1292, 575],
  State: [1292, 700],
  Chinatown: [1162, 860],
  'Tufts Medical Center': [1092, 930],
  'Forest Hills': [650, 1372],
  // Blue
  Wonderland: [1797, 206],
  Airport: [1505, 498],
  Maverick: [1457, 546],
  Aquarium: [1362, 640],
  'Government Center': [1222, 646],
  Bowdoin: [1177, 600],
  // Green
  'Medford/Tufts': [948, 186],
  Lechmere: [1208, 445],
  'Science Park/West End': [1240, 477],
  'North Station': [1268, 528],
  Haymarket: [1268, 575],
  Boylston: [1090, 778],
  Arlington: [998, 792],
  Copley: [920, 792],
  'Hynes Convention Center': [845, 792],
  Kenmore: [768, 792],
  'Union Square': [1077, 415],
  'Harvard Avenue': [495, 572],
  'Boston College': [207, 845],
  'Cleveland Circle': [310, 1002],
  Riverside: [350, 1182],
  Prudential: [868, 866],
  Symphony: [868, 905],
  'Heath Street': [620, 1173],
  // Silver
  Courthouse: [1390, 863],
  'World Trade Center': [1450, 863],
  'Silver Line Way': [1510, 863],
  'Design Center': [1625, 893],
  'Eastern Avenue': [1505, 368],
  'Box District': [1505, 330],
  'Bellingham Square': [1465, 300],
  Chelsea: [1420, 300],
  Nubian: [1092, 1233],
};

type Item = string | Pt;
interface Spec {
  key: string;
  line: TLine;
  /** Mattapan trolley: thinner */
  thin?: boolean;
  items: Item[];
  side: Side;
}

const SPECS: Spec[] = [
  { key: 'red', line: 'red', side: 'l', items: ['Alewife', 'Davis', 'Porter', 'Harvard', 'Central', 'Kendall/MIT', 'Charles/MGH', 'Park Street', 'Downtown Crossing', 'South Station'] },
  { key: 'redS', line: 'red', side: 'r', items: ['South Station', [1365, 923], 'Broadway', 'Andrew', 'JFK/UMass', [1365, 1262], [1287, 1340], 'Savin Hill', 'Fields Corner', 'Shawmut', 'Ashmont'] },
  { key: 'mattapan', line: 'red', thin: true, side: 'dl', items: ['Ashmont', 'Cedar Grove', [1287, 1556], [1263, 1580], 'Butler', 'Milton', 'Central Avenue', 'Valley Road', 'Capen Street', 'Mattapan'] },
  { key: 'braintree', line: 'red', side: 'r', items: ['JFK/UMass', [1365, 1268], 'North Quincy', 'Wollaston', 'Quincy Center', [1620, 1523], 'Quincy Adams', 'Braintree'] },
  { key: 'orange', line: 'orange', side: 'r', items: ['Oak Grove', 'Malden Center', 'Wellington', 'Assembly', 'Sullivan Square', 'Community College', 'North Station', 'Haymarket', 'State', [1292, 730], 'Downtown Crossing', 'Chinatown', 'Tufts Medical Center'] },
  { key: 'orangeS', line: 'orange', side: 'l', items: ['Tufts Medical Center', 'Back Bay', 'Massachusetts Ave', 'Ruggles', 'Roxbury Crossing', 'Jackson Square', 'Stony Brook', 'Green Street', 'Forest Hills'] },
  { key: 'blue', line: 'blue', side: 'r', items: ['Wonderland', 'Revere Beach', 'Beachmont', 'Suffolk Downs', 'Orient Heights', 'Wood Island', 'Airport', 'Maverick', 'Aquarium', 'State', 'Government Center', 'Bowdoin'] },
  { key: 'green', line: 'green', side: 'l', items: ['Medford/Tufts', 'Ball Square', 'Magoun Square', 'Gilman Square', 'East Somerville', 'Lechmere', 'Science Park/West End', [1268, 505], 'North Station', 'Haymarket', [1268, 600], 'Government Center', 'Park Street', 'Boylston', [1076, 792], 'Arlington', 'Copley', 'Hynes Convention Center', 'Kenmore'] },
  { key: 'union', line: 'green', side: 't', items: ['Union Square', [1178, 415], 'Lechmere'] },
  { key: 'b', line: 'green', side: 'r', items: ['Kenmore', [745, 792], 'Blandford Street', 'BU East', 'BU Central', 'Amory Street', 'Babcock Street', "Packard's Corner", [525, 572], 'Harvard Avenue'] },
  { key: 'b2', line: 'green', side: 'l', items: ['Harvard Avenue', [480, 572], 'Griggs Street', 'Allston Street', 'Warren Street', 'Washington Street', 'Sutherland Road', 'Chiswick Road', 'Chestnut Hill Ave', 'South Street', 'Boston College'] },
  { key: 'c', line: 'green', side: 'l', items: ['Kenmore', [705, 792], "Saint Mary's Street", 'Hawes Street', [625, 712], [600, 712], 'Kent Street', 'Saint Paul Street', 'Coolidge Corner', 'Summit Avenue', 'Brandon Hall', 'Washington Square', 'Tappan Street', 'Dean Road', 'Englewood Avenue', 'Cleveland Circle'] },
  { key: 'd', line: 'green', side: 'l', items: ['Kenmore', [740, 792], 'Fenway', 'Longwood', 'Brookline Village', 'Brookline Hills', 'Beaconsfield', 'Reservoir', 'Chestnut Hill', 'Newton Centre', 'Newton Highlands', 'Eliot', 'Waban', 'Woodland', 'Riverside'] },
  { key: 'e', line: 'green', side: 'r', items: ['Copley', [890, 792], [868, 814], 'Prudential', 'Symphony', [868, 925]] },
  { key: 'e2', line: 'green', side: 'l', items: [[868, 925], 'Northeastern', 'Museum of Fine Arts', 'Longwood Medical Area', 'Brigham Circle', 'Fenwood Road', 'Mission Park', 'Riverway', 'Back of the Hill', 'Heath Street'] },
  { key: 'slWash', line: 'silver', side: 'r', items: ['Chinatown', 'Tufts Medical Center', 'Herald Street', 'East Berkeley Street', 'Union Park Street', 'Newton Street', 'Worcester Square', 'Washington St & Mass Ave', 'Lenox Street', 'Melnea Cass Blvd', 'Nubian'] },
  { key: 'slWater', line: 'silver', side: 'dr', items: ['South Station', [1340, 863], 'Courthouse', 'World Trade Center', 'Silver Line Way', [1540, 863], [1570, 893], 'Design Center'] },
  { key: 'slAir', line: 'silver', side: 'r', items: ['Silver Line Way', [1540, 863], [1580, 823], [1580, 573], 'Airport', 'Eastern Avenue', 'Box District', [1505, 300], 'Bellingham Square', 'Chelsea'] },
];

/** Labels that read better somewhere other than their route's default side */
const SIDE: Record<string, Side> = {
  Alewife: 'l',
  'Downtown Crossing': 'r',
  'South Station': 'r',
  State: 'r',
  'Oak Grove': 't',
  Wonderland: 't',
  Bowdoin: 't',
  Airport: 'l',
  'North Station': 'l',
  Haymarket: 'r',
  'Government Center': 'l',
  'Park Street': 'l',
  Boylston: 'r',
  Arlington: 'ur',
  Copley: 'ur',
  'Hynes Convention Center': 'ur',
  Kenmore: 'ur',
  'Harvard Avenue': 't',
  'Union Square': 't',
  'Medford/Tufts': 'l',
  Chinatown: 'r',
  'Tufts Medical Center': 'r',
  'Forest Hills': 'r',
  'Design Center': 'r',
  'Bellingham Square': 't',
  Chelsea: 'l',
  'Cedar Grove': 'r',
  Mattapan: 'l',
  'Savin Hill': 'r',
  'Fields Corner': 'r',
  Shawmut: 'r',
  Ashmont: 'r',
  Broadway: 'r',
  Andrew: 'r',
  'JFK/UMass': 'r',
  Prudential: 'r',
  Symphony: 'r',
};

/** Shorter names, like the signs */
export const SHORT_LABEL: Record<string, string> = {
  'Science Park/West End': 'Science Park',
  'Hynes Convention Center': 'Hynes',
  'Government Center': "Gov't Center",
  'Tufts Medical Center': 'Tufts Medical',
  'Massachusetts Ave': 'Mass. Ave',
  'Washington St & Mass Ave': 'Mass. Ave (SL)',
  'Longwood Medical Area': 'Longwood Medical',
  'Melnea Cass Blvd': 'Melnea Cass',
  'Herald Street': 'Herald St',
  'East Berkeley Street': 'E. Berkeley St',
  'Union Park Street': 'Union Park St',
  'Newton Street': 'Newton St',
  'Worcester Square': 'Worcester Sq',
  'Lenox Street': 'Lenox St',
  'Silver Line Way': 'SL Way',
  'World Trade Center': 'World Trade Ctr',
};

export interface Route {
  key: string;
  line: TLine;
  thin?: boolean;
  /** The drawn path: pinned stops and waypoints */
  path: Pt[];
}
export interface StopGeo {
  name: string;
  /** One point per distinct spot (e.g. North Station has a Green and an Orange platform) */
  pts: Pt[];
  side: Side;
}

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function pointAlong(path: Pt[], t: number): Pt {
  const lens = path.slice(1).map((p, i) => dist(path[i], p));
  const total = lens.reduce((a, b) => a + b, 0);
  let d = t * total;
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i] || i === lens.length - 1) {
      const f = lens[i] ? Math.min(1, d / lens[i]) : 0;
      return [path[i][0] + (path[i + 1][0] - path[i][0]) * f, path[i][1] + (path[i + 1][1] - path[i][1]) * f];
    }
    d -= lens[i];
  }
  return path[path.length - 1];
}

function build() {
  const routes: Route[] = [];
  const stops = new Map<string, StopGeo>();
  const addStop = (name: string, p: Pt, side: Side) => {
    const s = stops.get(name) ?? stops.set(name, { name, pts: [], side: SIDE[name] ?? side }).get(name)!;
    if (!s.pts.some((q) => dist(q, p) < 3)) s.pts.push(p);
  };
  const pinned = (name: string, key: string, line: TLine) => ANCHORS[`${name}@${key}`] ?? ANCHORS[`${name}@${line}`] ?? ANCHORS[name];

  for (const spec of SPECS) {
    const path: Pt[] = [];
    // Walk the items; collect runs of unpinned stops between pinned points
    let lastFixed = -1;
    const fixedAt: (Pt | null)[] = spec.items.map((it) => (typeof it === 'string' ? pinned(it, spec.key, spec.line) ?? null : it));
    spec.items.forEach((it, i) => {
      const p = fixedAt[i];
      if (!p) return;
      path.push(p);
      if (typeof it === 'string') {
        // Place the stops since the previous pinned stop evenly along the way here
        const prevStop = (() => {
          for (let j = i - 1; j >= 0; j--) if (fixedAt[j] && (typeof spec.items[j] === 'string' || j === 0)) return j;
          return -1;
        })();
        if (prevStop >= 0) {
          const between = spec.items.slice(prevStop + 1, i).filter((x, k) => typeof x === 'string' && !fixedAt[prevStop + 1 + k]) as string[];
          const sub: Pt[] = [];
          for (let j = prevStop; j <= i; j++) if (fixedAt[j]) sub.push(fixedAt[j]!);
          between.forEach((name, k) => addStop(name, pointAlong(sub, (k + 1) / (between.length + 1)), spec.side));
        }
        addStop(it, p, spec.side);
      }
      lastFixed = i;
    });
    if (lastFixed < 0) continue;
    routes.push({ key: spec.key, line: spec.line, thin: spec.thin, path });
  }
  return { routes, stops };
}

export const LAYOUT = build();
