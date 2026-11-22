import { DURATIONS, NEIGHBORHOOD_BY_ID, PRICE_TIERS, priceRank } from './data/meta.js';
import type { Place, PriceTier, RecRequest, Suggestion } from './types.js';

/**
 * A person's taste, as the recommender sees it. A solo request has one member;
 * a group request has one per group member and is scored so that the pick has
 * to work for *everyone*, not just the average.
 */
export interface TasteProfile {
  id: string;
  firstName: string;
  /** Tags picked during onboarding (food + event + activity) */
  prefs: Set<string>;
  /** Learned affinities in [-1, 1] from ratings / feedback / feed reactions */
  weights: Record<string, number>;
  /** Places already done */
  doneIds: Set<string>;
  /** Places saved from the feed */
  wantIds: Set<string>;
  /** Highest price tier this person is comfortable with */
  budget?: PriceTier;
}

export interface RecContext {
  places: Place[];
  members: TasteProfile[];
  communityRatings?: Record<string, { avg: number; count: number }>;
  now?: Date;
  /** Places shown in the previous round (for "something different") */
  lastShown?: Place[];
  /** Injectable for deterministic tests */
  random?: () => number;
  /** The person asking, so group reasons can say "You" instead of their name */
  selfId?: string;
}

export interface RecResult {
  suggestions: Suggestion[];
  /** True when we've run out of fresh matches and are repeating */
  exhausted: boolean;
  /** Effective budget cap after applying group budgets / "cheaper" feedback */
  budget: PriceTier;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** How much one person would like a place, roughly 0..1.2 */
export function interestScore(place: Place, m: TasteProfile): number {
  const matches = place.tags.filter((t) => m.prefs.has(t)).length;
  // Someone who skipped onboarding gets a neutral score instead of zero
  let s = m.prefs.size === 0 ? 0.5 : 0.25 + Math.min(matches, 2) * 0.3;
  const learned = place.tags.reduce((acc, t) => acc + (m.weights[t] ?? 0), 0);
  s += clamp(learned, -1, 1) * 0.25;
  if (m.wantIds.has(place.id)) s += 0.3;
  if (m.doneIds.has(place.id)) s -= 0.35;
  return clamp(s, 0, 1.2);
}

/**
 * Group interest: blend of the least-happy member and the average.
 * This keeps one person from being dragged somewhere they'd hate.
 */
export function groupInterest(place: Place, members: TasteProfile[]): number {
  const scores = members.map((m) => interestScore(place, m));
  const min = Math.min(...scores);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  return members.length === 1 ? scores[0] : 0.6 * min + 0.4 * mean;
}

export function effectiveBudget(req: RecRequest, members: TasteProfile[]): PriceTier {
  let rank = priceRank(req.price);
  if (members.length > 1) {
    for (const m of members) if (m.budget) rank = Math.min(rank, priceRank(m.budget));
  }
  if (req.feedback?.cheaper) rank = Math.max(0, rank - 1);
  return PRICE_TIERS[rank].id;
}

interface Candidate {
  place: Place;
  stage: number;
  score: number;
  stretchNote?: string;
}

/**
 * Constraint relaxation ladder. We only move down a stage when the stricter
 * stage can't produce two options, and anything found at a looser stage is
 * labeled so the user knows what we stretched.
 *   0: exact match
 *   1: ignore time-of-day, allow up to 1.5× the time frame
 *   2: anywhere in the city
 *   3: one price tier over budget
 *   4: repeat things already shown this session
 */
const MAX_STAGE = 4;

export function recommend(req: RecRequest, ctx: RecContext): RecResult {
  const now = ctx.now ?? new Date();
  const month = now.getMonth() + 1;
  const random = ctx.random ?? Math.random;
  const duration = DURATIONS.find((d) => d.id === req.duration) ?? DURATIONS[1];
  const budget = effectiveBudget(req, ctx.members);
  const budgetRank = priceRank(budget);
  const exclude = new Set(req.excludeIds ?? []);
  const moreTags = new Set(req.feedback?.moreTags ?? []);
  const lastShownTags = new Set((ctx.lastShown ?? []).flatMap((p) => p.tags));
  const near = req.location === 'anywhere' ? [] : NEIGHBORHOOD_BY_ID[req.location]?.near ?? [];

  const pool: Candidate[] = [];
  for (const place of ctx.places) {
    if (place.type !== req.type) continue;
    // Never recommend something that's out of season
    if (place.months && !place.months.includes(month)) continue;

    const stage = stageFor(place);
    if (stage === null) continue;
    pool.push({ place, stage: stage.stage, stretchNote: stage.note, score: scoreFor(place, stage.stage) });
  }

  function stageFor(place: Place): { stage: number; note?: string } | null {
    const pr = priceRank(place.price);
    const timeOk = !req.timeOfDay || place.times.includes(req.timeOfDay);
    const durOk = place.minutes <= duration.maxMinutes;
    const durStretchOk = place.minutes <= duration.maxMinutes * 1.5;
    if (place.minutes > duration.maxMinutes * 2) return null; // way too long, don't even offer it
    const locOk = req.location === 'anywhere' || place.neighborhood === req.location || near.includes(place.neighborhood);

    let stage = 0;
    const notes: string[] = [];
    if (!timeOk || !durOk) {
      stage = 1;
      if (!durStretchOk) stage = Math.max(stage, 2);
      if (!timeOk) notes.push(`Usually best in the ${place.times[0] === 'late' ? 'late night' : place.times[0]}`);
      if (!durOk) notes.push(`Takes ~${formatMinutes(place.minutes)}`);
    }
    if (!locOk) {
      stage = Math.max(stage, 2);
      notes.push(`A bit outside ${NEIGHBORHOOD_BY_ID[req.location as keyof typeof NEIGHBORHOOD_BY_ID]?.label ?? 'your area'}`);
    }
    if (pr > budgetRank) {
      if (pr > budgetRank + 1) return null; // never more than one tier over
      stage = Math.max(stage, 3);
      notes.push('A little over budget');
    }
    if (exclude.has(place.id)) {
      stage = 4;
      notes.push("You've seen this one already");
    }
    return { stage, note: notes.length ? notes.join(' · ') : undefined };
  }

  function scoreFor(place: Place, stage: number): number {
    const interest = groupInterest(place, ctx.members);

    let loc = 0.7;
    if (req.location !== 'anywhere') {
      if (place.neighborhood === req.location) loc = 1;
      else if (near.includes(place.neighborhood)) loc = req.feedback?.closer ? 0.35 : 0.65;
      else loc = 0.15;
    }

    const priceFit = clamp(1 - 0.12 * Math.abs(budgetRank - priceRank(place.price)), 0, 1);
    const durFit = 1 - Math.min(1, Math.abs(place.minutes - duration.targetMinutes) / duration.targetMinutes) * 0.5;

    let s = 0.4 * interest + 0.25 * loc + 0.15 * priceFit + 0.1 * durFit;

    const community = ctx.communityRatings?.[place.id];
    if (community && community.count > 0) s += ((community.avg - 3) / 2) * 0.08;
    if (place.months) s += 0.05; // seasonal things are fleeting — nudge them up
    if (place.tags.some((t) => moreTags.has(t))) s += 0.25;
    if (req.feedback?.different) {
      const overlap = place.tags.filter((t) => lastShownTags.has(t)).length;
      s -= Math.min(overlap, 2) * 0.12;
    }
    s += random() * 0.06; // a little variety so "regenerate" feels alive
    s -= stage * 0.3;
    return s;
  }

  // Use the strictest stage that still yields two options
  let usable: Candidate[] = [];
  let usedStage = 0;
  for (let stage = 0; stage <= MAX_STAGE; stage++) {
    usable = pool.filter((c) => c.stage <= stage);
    usedStage = stage;
    if (usable.length >= 2) break;
  }
  usable.sort((a, b) => b.score - a.score);

  let picks = pickDiverse(usable);
  // If they told us what they want ("more Japanese") and nothing in budget/area fits,
  // surface the closest match anyway, clearly labeled, instead of ignoring them.
  if (moreTags.size && !picks.some((c) => c.place.tags.some((t) => moreTags.has(t)))) {
    const wanted = pool
      .filter((c) => c.stage <= 3 && !picks.includes(c) && c.place.tags.some((t) => moreTags.has(t)))
      .sort((a, b) => b.score - a.score)[0];
    if (wanted) picks = [wanted, ...picks].slice(0, 2);
  }
  return {
    suggestions: picks.map((c) => ({
      place: c.place,
      score: Math.round(c.score * 100) / 100,
      reasons: buildReasons(c.place, req, ctx, budget),
      stretchNote: c.stretchNote,
      communityRating: ctx.communityRatings?.[c.place.id],
    })),
    exhausted: usedStage >= 4,
    budget,
  };
}

/** Pick the best option, then the best one that feels different from it (if it's close in score). */
function pickDiverse(sorted: Candidate[]): Candidate[] {
  if (sorted.length <= 2) return sorted.slice(0, 2);
  const [first, ...rest] = sorted;
  const different = rest.find(
    (c) => c.place.neighborhood !== first.place.neighborhood || c.place.tags[0] !== first.place.tags[0],
  );
  const second = different && different.score >= rest[0].score - 0.15 ? different : rest[0];
  return [first, second];
}

function buildReasons(place: Place, req: RecRequest, ctx: RecContext, budget: PriceTier): string[] {
  const reasons: string[] = [];
  const members = ctx.members;
  const moreTags = new Set(req.feedback?.moreTags ?? []);

  const asked = place.tags.find((t) => moreTags.has(t));
  if (asked) reasons.push(`More ${lowerTag(asked)}, like you asked`);

  if (members.length === 1) {
    const m = members[0];
    const matched = place.tags.filter((t) => m.prefs.has(t));
    if (matched.length) reasons.push(`You're into ${joinNice(matched.slice(0, 2))}`);
    if (m.wantIds.has(place.id)) reasons.push('Saved from your feed');
    const learned = place.tags.reduce((a, t) => a + (m.weights[t] ?? 0), 0);
    if (learned >= 0.2) reasons.push('Like other spots you rated highly');
  } else {
    const everyone = place.tags.filter((t) => members.every((m) => m.prefs.has(t)));
    if (everyone.length) {
      reasons.push(`Everyone's into ${joinNice(everyone.slice(0, 2))}`);
    } else {
      // Explain who this one is for ("You & Maya love live music")
      const nameOf = (m: TasteProfile) => (m.id === ctx.selfId ? 'You' : m.firstName);
      const fans = place.tags
        .map((t) => ({ t, who: members.filter((m) => m.prefs.has(t)).map(nameOf) }))
        .filter((x) => x.who.length > 0)
        .sort((a, b) => b.who.length - a.who.length)[0];
      if (fans) {
        const who = [...fans.who].sort((a, b) => Number(b === 'You') - Number(a === 'You')).slice(0, 3);
        const verb = who.length === 1 && who[0] !== 'You' ? 'loves' : 'love';
        reasons.push(`${joinNice(who)} ${verb} ${lowerTag(fans.t)}`);
      }
    }
    if (members.every((m) => !m.doneIds.has(place.id))) reasons.push('New to all of you');
    if (budget !== req.price) reasons.push("Fits everyone's budget");
  }

  if (req.location === 'anywhere') {
    reasons.push(NEIGHBORHOOD_BY_ID[place.neighborhood].label);
  } else if (place.neighborhood === req.location) {
    reasons.push(`Right in ${NEIGHBORHOOD_BY_ID[place.neighborhood].label}`);
  } else {
    reasons.push(`Quick hop to ${NEIGHBORHOOD_BY_ID[place.neighborhood].label}`);
  }

  if (place.price === 'free') reasons.push('Free!');
  if (place.months) reasons.push('In season right now');

  // (community ratings are shown separately on the card)
  return reasons.slice(0, 4);
}

/** Lowercase a tag for use mid-sentence, but keep cuisines capitalized ("Japanese"). */
function lowerTag(tag: string): string {
  return /^(Italian|Chinese|Japanese|Greek|Asian|Mediterranean|Mexican)$/.test(tag) ? tag : tag.toLowerCase();
}

function joinNice(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} & ${items[items.length - 1]}`;
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = min / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(1)} hr${h > 1 ? 's' : ''}`;
}

/**
 * Score how well a (simulated or real) local fits a crew heading to `place`
 * alongside `user`. Used to fill a group when someone opts in.
 */
export function companionScore(place: Place, local: TasteProfile & { age?: number }, user: TasteProfile & { age?: number }): number {
  const sharedPrefs = [...local.prefs].filter((t) => user.prefs.has(t)).length;
  const ageGap = local.age && user.age ? Math.abs(local.age - user.age) : 0;
  return interestScore(place, local) + sharedPrefs * 0.12 - Math.max(0, ageGap - 4) * 0.04;
}
