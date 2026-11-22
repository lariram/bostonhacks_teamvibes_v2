import type { PlaceType } from '../types.js';

/** Keyword → interest tag rules, matched against title/category/description */
const RULES: [RegExp, string[]][] = [
  [/\b(comedy|comedian|stand-?up|improv|sketch)\b/i, ['Comedy']],
  [/\b(symphony|orchestra|philharmonic|chamber music|string quartet|choir|chorus|choral|classical|wind ensemble|concert band)\b/i, ['Orchestra', 'Live music']],
  [/\b(concert|live music|jazz|recital|rock|hip.?hop|indie|singer|songwriter|acoustic|r&b|folk|edm|dj set|band)\b/i, ['Live music']],
  [/\b(theat(er|re)|musical|ballet|dance|opera|cabaret|drag|performance|play)\b/i, ['Performing arts']],
  [/\b(hockey|basketball|football|soccer|volleyball|baseball|lacrosse|rowing|swim(ming)?|water polo|field hockey|wrestling|fencing|celtics|bruins|red sox|patriots|athletics)\b/i, ['Sporting events']],
  [/\b(exhibit|exhibition|gallery|museum)\b/i, ['Museums']],
  [/\b(crafts?|workshop|pottery|ceramics|knit(ting)?|painting|drawing|maker|zine|arts?)\b/i, ['Arts & crafts']],
  [/\b(market|fair|bazaar|vintage|flea|pop-?up|book sale)\b/i, ['Shopping']],
  [/\b(hike|walk|garden|park|nature|birding|yoga|meditation|outdoors?|run club)\b/i, ['Nature']],
  [/\b(trivia|game night|board games?|arcade|bingo|chess|esports)\b/i, ['Games']],
  [/\b(history|historic|heritage|walking tour)\b/i, ['History']],
  [/\b(holiday|tree lighting|winter|halloween|thanksgiving|christmas|hanukkah|kwanzaa|new year|festival|lunar new year)\b/i, ['Seasonal']],
  [/\b(party|club night|rave|mixer|social)\b/i, ['Parties']],
  [/\b(film|movie|screening|cinema)\b/i, ['Small events']],
  [/\b(reading|book talk|author|poetry|open mic|storytelling)\b/i, ['Small events']],
];

const COLLEGE = /\b(ncaa|university|college|terriers|eagles|huskies|crimson|engineers|jumbos|beavers|vs\.?)\b/i;

/**
 * Tags from the strongest signals first (title, categories, keywords). Long
 * descriptions are noisy ("protest art", "Revolution"), so they only count
 * when the strong signals say nothing.
 */
export function tagsFor(primary: string, description = ''): string[] {
  const strong = tagsFromText(primary);
  return strong.length ? strong : tagsFromText(description);
}

export function tagsFromText(text: string): string[] {
  const tags = new Set<string>();
  for (const [re, add] of RULES) if (re.test(text)) add.forEach((t) => tags.add(t));
  if (tags.has('Sporting events') && COLLEGE.test(text)) tags.add('College sports');
  return [...tags];
}

const EMOJI: [string, string][] = [
  ['Comedy', '😂'],
  ['Orchestra', '🎻'],
  ['Live music', '🎶'],
  ['College sports', '🏟️'],
  ['Sporting events', '🏟️'],
  ['Performing arts', '🎭'],
  ['Museums', '🖼️'],
  ['Arts & crafts', '🎨'],
  ['Shopping', '🛍️'],
  ['Nature', '🌿'],
  ['Games', '🎲'],
  ['Seasonal', '✨'],
  ['Parties', '🪩'],
  ['History', '🏛️'],
];

export function emojiFor(tags: string[], type: PlaceType): string {
  return EMOJI.find(([t]) => tags.includes(t))?.[1] ?? (type === 'food' ? '🍽️' : type === 'activity' ? '📍' : '🎟️');
}

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…' };

/** "Boston Ballet&#8217;s" → "Boston Ballet’s" */
export function decodeHtml(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED[name.toLowerCase()] ?? m);
}

/** Strip HTML and collapse whitespace; keep it short for a card */
export function cleanText(text: string | null | undefined, max = 200): string {
  const plain = decodeHtml(String(text ?? '').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20)).trim()}…`;
}

export function priceTierFor(amount: number): 'free' | 'under10' | '10to20' | '20to40' | '40plus' {
  if (amount <= 0) return 'free';
  if (amount < 10) return 'under10';
  if (amount < 20) return '10to20';
  if (amount < 40) return '20to40';
  return '40plus';
}

/** Short stable id from a string (for sources without their own ids) */
export function shortHash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}
