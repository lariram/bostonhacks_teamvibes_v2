/** Working name. Change it here and it updates across the app. */
export const APP_NAME = 'common';
export const TAGLINE = 'Two picks. One crew. Your next stop.';
export const BRAND_STORY = 'Named for Boston Common, where America’s first subway opened in 1897.';

/** MBTA line colors: the whole visual system is built on these. */
export const LINES = {
  red: '#DA291C',
  orange: '#ED8B00',
  green: '#00843D',
  blue: '#003DA5',
  silver: '#7C878E',
  purple: '#80276C', // commuter rail
  teal: '#008EAA', // ferry
  yellow: '#FFC72C', // bus
} as const;
export type LineName = keyof typeof LINES;

/** Each kind of outing rides its own line */
export const TYPE_LINE: Record<string, LineName> = {
  event: 'red',
  activity: 'green',
  food: 'orange',
};
export const TYPE_COLORS: Record<string, string> = {
  event: LINES.red,
  activity: LINES.green,
  food: LINES.orange,
};

/** Which T lines serve each neighborhood (shown as bullets on the chips) */
export const NEIGHBORHOOD_LINES: Record<string, LineName[]> = {
  downtown: ['red', 'orange', 'green', 'blue'],
  theater: ['green', 'orange'],
  chinatown: ['orange', 'silver'],
  northend: ['green', 'orange'],
  backbay: ['green', 'orange'],
  fenway: ['green'],
  seaport: ['silver'],
  charlestown: ['orange'],
  cambridge: ['red'],
  somerville: ['red', 'green'],
  allston: ['green'],
  brighton: ['green'],
};

/** Crews get a line of their own, picked from the group id */
const CREW_LINES: LineName[] = ['blue', 'purple', 'teal', 'red', 'green', 'orange'];
export function crewLine(groupId: string): LineName {
  let h = 0;
  for (const c of groupId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return CREW_LINES[h % CREW_LINES.length];
}

/** Pull line names out of a stop description like "Harvard (Red)" or "Silver Line: Courthouse" */
export function linesFromStop(stop: string): LineName[] {
  const s = stop.toLowerCase();
  const out: LineName[] = [];
  if (s.includes('red')) out.push('red');
  if (s.includes('orange')) out.push('orange');
  if (s.includes('green')) out.push('green');
  if (s.includes('blue')) out.push('blue');
  if (s.includes('silver')) out.push('silver');
  if (s.includes('ferry')) out.push('teal');
  if (s.includes('bus')) out.push('yellow');
  return out;
}
