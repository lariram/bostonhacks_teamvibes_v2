import { CLASSICS, DURATION_MINUTES, NEIGHBORHOOD_BY_ID, PRICE_TIERS, priceRank, TOURIST_TRAPS } from './data/meta.js';
import { bostonParts, bostonWallTime, formatBostonTime, timeOfDayAt } from './live/time.js';
import { distanceKm, neighborhoodCenter } from './live/geo.js';
import { scheduleFor, visitWindow } from './hours.js';
import { estimateTravel, type Travel } from './travel.js';
import type { NeighborhoodId, Persona, Place, PriceTier, RecRequest, Suggestion, TimeOfDay } from './types.js';

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
  persona?: Persona;
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
  /** Some picks came from the optional anywhere-on-the-T search */
  widened?: boolean;
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
  widened?: boolean;
  trip?: Trip;
}

interface Trip {
  travel: Travel & { fromYou: boolean };
  arrive: Date;
  openUntil?: Date;
  opensAt?: Date;
  hoursApprox?: boolean;
}

/**
 * Constraint relaxation ladder. We only move down a stage when the stricter
 * stage can't produce two options, and anything found at a looser stage is
 * labeled so the user knows what we stretched. Location never stretches past
 * the neighborhoods right next door.
 *   0: exact match in your neighborhood
 *   1: a neighborhood right next door
 *   2: (places, not live events) outside the usual hours / a bit longer than your time
 *   3: one price tier over budget
 *   4: repeat things already shown this session
 */
const MAX_STAGE = 4;
const MIN = 60_000;

const BUCKET_START: Record<TimeOfDay, number> = { morning: 8, afternoon: 12, evening: 17, late: 22 };

/** The time window you asked for: [start, end] */
export function requestWindow(req: RecRequest, now: Date): { start: Date; end: Date; minutes: number; timeOfDay: TimeOfDay } {
  const minutes = Math.max(15, Math.min(req.durationMinutes ?? DURATION_MINUTES[req.duration ?? 'short'] ?? 120, 720));
  let start = req.startAt ? new Date(req.startAt) : now;
  if (!req.startAt && req.timeOfDay) start = bostonWallTime(bostonParts(now).date, BUCKET_START[req.timeOfDay]);
  if (Number.isNaN(start.getTime()) || start < now) start = now; // can't plan in the past
  return { start, end: new Date(start.getTime() + minutes * MIN), minutes, timeOfDay: req.timeOfDay ?? timeOfDayAt(start) };
}

export function recommend(req: RecRequest, ctx: RecContext): RecResult {
  const now = ctx.now ?? new Date();
  const random = ctx.random ?? Math.random;
  const win = requestWindow(req, now);
  const month = Number(bostonParts(win.start).date.slice(5, 7)); // season of the day you're planning for
  const budget = effectiveBudget(req, ctx.members);
  const budgetRank = priceRank(budget);
  const exclude = new Set(req.excludeIds ?? []);
  const moreTags = new Set(req.feedback?.moreTags ?? []);
  const lastShownTags = new Set((ctx.lastShown ?? []).flatMap((p) => p.tags));
  const anywhere = req.location === 'anywhere';
  const near = req.location === 'anywhere' ? [] : NEIGHBORHOOD_BY_ID[req.location]?.near ?? [];
  const me = ctx.members.find((m) => m.id === ctx.selfId) ?? ctx.members[0];

  const eligible = (place: Place) =>
    place.type === req.type &&
    // "Event" means a real, dated event, never a venue that might have something on
    (req.type !== 'event' || !!place.live) &&
    // Never recommend something that's out of season
    (!place.months || place.months.includes(month));

  // Where you're starting from: your location if the app has it, otherwise the area you picked
  const origin: [number, number] = req.from
    ? [req.from.lat, req.from.lng]
    : neighborhoodCenter((req.location === 'anywhere' ? 'downtown' : req.location) as NeighborhoodId);

  const pool: Candidate[] = [];
  for (const place of ctx.places) {
    if (!eligible(place)) continue;
    const stage = stageFor(place);
    if (stage === null) continue;
    pool.push({ place, stage: stage.stage, stretchNote: stage.note, trip: stage.trip, score: scoreFor(place, stage.stage, stage.trip) });
  }

  function stageFor(place: Place, anyLocation = false): { stage: number; note?: string; trip?: Trip } | null {
    // Location: your neighborhood, or right next door. Never across town (unless you opted
    // into the wider search, which is a separate pass below).
    const sameHood = anyLocation || (anywhere ? place.neighborhood !== 'greater' : place.neighborhood === req.location);
    if (!sameHood && !near.includes(place.neighborhood)) return null;
    let stage = sameHood ? 0 : 1;
    const notes: string[] = [];

    // Getting there takes time: everything below is judged at the moment you'd arrive
    const travel = { ...estimateTravel(origin, [place.lat, place.lng]), fromYou: !!req.from };
    const arrive = new Date(win.start.getTime() + travel.minutes * MIN);
    const trip: Trip = { travel, arrive };

    if (place.live) {
      // Live listings must actually be catchable in your window
      const live = place.live;
      if (live.timeTBA) return null;
      const s = Date.parse(live.startsAt);
      const e = live.endsAt ? Date.parse(live.endsAt) : s + place.minutes * MIN;
      if (live.openHours) {
        let openS = s;
        let openE = e;
        if (bostonParts(new Date(s)).date !== bostonParts(new Date(e)).date) {
          // A multi-day run: use its daily hours on the day you're going
          const day = bostonParts(win.start).date;
          const a = bostonParts(new Date(s));
          const b = bostonParts(new Date(e));
          let [sh, sm, eh, em] = [a.hour, a.minute, b.hour, b.minute];
          if (eh * 60 + em <= sh * 60 + sm) [sh, sm, eh, em] = [10, 0, 17, 0];
          openS = Math.max(s, bostonWallTime(day, sh, sm).getTime());
          openE = Math.min(e, bostonWallTime(day, eh, em).getTime());
        }
        // you need 30+ minutes there after you arrive, before it closes
        const from = Math.max(openS, arrive.getTime());
        if (from > win.end.getTime() || openE - from < 30 * MIN) return null;
        trip.openUntil = new Date(openE);
        if (openS > arrive.getTime() + 10 * MIN) trip.opensAt = new Date(openS);
      } else {
        if (s < now.getTime() - 30 * MIN) return null; // started too long ago
        if (s < win.start.getTime() - 30 * MIN || s > win.end.getTime()) return null; // not in your window
        if (s < arrive.getTime() - 15 * MIN) return null; // you'd get there more than 15 min late
        if (e > win.end.getTime() + 15 * MIN) {
          notes.push(`${live.endEstimated ? 'Runs about' : 'Runs until'} ${live.endEstimated ? formatMinutes(place.minutes) : formatBostonTime(new Date(e))}, past your window`);
        }
      }
    } else {
      // Curated places: open when you get there (with time for a real visit), and fits your time
      if (place.minutes > win.minutes * 2) return null;
      const hours = place.openingHours ?? scheduleFor(place.id);
      let timeOk = place.times.includes(win.timeOfDay);
      if (hours) {
        const visit = visitWindow(hours.schedule, arrive, win.end);
        if (!visit) return null; // closed by the time you'd get there (or all window long)
        const left = (visit.until.getTime() - visit.from.getTime()) / MIN;
        if (left < Math.min(place.minutes, 45)) return null; // not enough time before it closes
        trip.openUntil = visit.until;
        trip.hoursApprox = hours.approx;
        if (visit.from.getTime() > arrive.getTime() + 10 * MIN) {
          trip.opensAt = visit.from;
          notes.push(`Opens at ${formatBostonTime(visit.from)}`);
        }
        if (left < place.minutes) notes.push(`Closes at ${formatBostonTime(visit.until)}, so a shorter visit`);
        timeOk = true; // real hours beat our "best time of day" guess
      }
      const durOk = place.minutes <= win.minutes;
      if (!timeOk || !durOk) {
        if (place.minutes > win.minutes * 1.5) return null;
        stage = Math.max(stage, 2);
        if (!timeOk) notes.push(`Usually best in the ${place.times[0] === 'late' ? 'late night' : place.times[0]}`);
        if (!durOk) notes.push(`Takes ~${formatMinutes(place.minutes)}`);
      }
    }

    const pr = priceRank(place.price);
    if (pr > budgetRank) {
      if (pr > budgetRank + 1) return null; // never more than one tier over
      stage = Math.max(stage, 3);
      notes.push('A little over budget');
    }
    if (exclude.has(place.id)) {
      stage = 4;
      notes.push("You've seen this one already");
    }
    return { stage, note: notes.length ? notes.join(' · ') : undefined, trip };
  }

  function scoreFor(place: Place, stage: number, trip?: Trip): number {
    const interest = groupInterest(place, ctx.members);
    const loc = anywhere ? 0.7 : place.neighborhood === req.location ? 1 : near.includes(place.neighborhood) ? (req.feedback?.closer ? 0.25 : 0.45) : 0.2;
    const priceFit = clamp(1 - 0.12 * Math.abs(budgetRank - priceRank(place.price)), 0, 1);
    const durFit = 1 - Math.min(1, Math.abs(place.minutes - win.minutes) / win.minutes) * 0.5;

    let s = 0.4 * interest + 0.3 * loc + 0.15 * priceFit + 0.1 * durFit;

    const community = ctx.communityRatings?.[place.id];
    if (community && community.count > 0) s += ((community.avg - 3) / 2) * 0.08;
    if (place.months) s += 0.05; // seasonal things are fleeting — nudge them up
    if (place.live) s += 0.12; // only happening today
    s += personaBoost(place, me?.persona);
    if (place.tags.some((t) => moreTags.has(t))) s += 0.25;
    if (req.feedback?.different) {
      const overlap = place.tags.filter((t) => lastShownTags.has(t)).length;
      s -= Math.min(overlap, 2) * 0.12;
    }
    if (trip) s -= Math.max(0, trip.travel.minutes - 15) * 0.004; // a long trip is a small cost
    s += random() * 0.06; // a little variety so "regenerate" feels alive
    s -= stage * 0.3;
    return s;
  }

  // Use the strictest stage that still yields two options
  let usable: Candidate[] = [];
  for (let stage = 0; stage <= MAX_STAGE; stage++) {
    usable = pool.filter((c) => c.stage <= stage);
    if (usable.length >= 2) break;
  }
  usable.sort((a, b) => b.score - a.score);

  let picks = pickDiverse(usable);

  // Optional wider search: if there's not enough nearby, look anywhere you can reach on the
  // T (subway, light rail, Silver Line; no Commuter Rail). Closer is better, and it's labeled.
  let widened = false;
  if (req.widen && !anywhere && picks.length < 2) {
    const center = neighborhoodCenter(req.location as NeighborhoodId);
    const taken = new Set(pool.map((c) => c.place.id));
    const wider: Candidate[] = [];
    for (const place of ctx.places) {
      if (taken.has(place.id) || !eligible(place)) continue;
      const st = stageFor(place, true);
      if (st === null || st.stage >= 4) continue;
      const km = distanceKm(center, [place.lat, place.lng]);
      const where = place.neighborhood === 'greater' ? place.live?.area ?? 'Greater Boston' : NEIGHBORHOOD_BY_ID[place.neighborhood].label;
      wider.push({
        place,
        stage: st.stage,
        widened: true,
        trip: st.trip,
        stretchNote: [`Outside ${NEIGHBORHOOD_BY_ID[req.location as NeighborhoodId].label}: ${where}, ~${km.toFixed(1)} km`, st.note]
          .filter(Boolean)
          .join(' · '),
        score: scoreFor(place, st.stage, st.trip) - km * 0.04,
      });
    }
    wider.sort((a, b) => b.score - a.score);
    const extra = wider.slice(0, 2 - picks.length);
    widened = extra.length > 0;
    picks = [...picks, ...extra];
  }
  // If they told us what they want ("more Japanese") and nothing in budget fits,
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
      reasons: buildReasons(c.place, req, ctx, budget, now),
      stretchNote: c.stretchNote,
      widened: c.widened || undefined,
      travel: c.trip?.travel,
      arriveAt: c.trip?.arrive.toISOString(),
      openUntil: c.trip?.openUntil?.toISOString(),
      opensAt: c.trip?.opensAt?.toISOString(),
      hoursApprox: c.trip?.hoursApprox,
      communityRating: ctx.communityRatings?.[c.place.id],
    })),
    exhausted: picks.some((c) => c.stage >= 4), // only when we're actually repeating something
    widened,
    budget,
  };
}

/** Nudges based on who you are (student, local, visitor, newcomer) */
export function personaBoost(place: Place, persona?: Persona): number {
  switch (persona) {
    case 'student':
      return (place.live?.source === 'localist' ? 0.1 : 0) + (place.price === 'free' || place.price === 'under10' ? 0.05 : 0);
    case 'local':
      return (TOURIST_TRAPS.has(place.id) ? -0.15 : 0) + (place.tags.includes('Locally owned') ? 0.06 : 0);
    case 'visitor':
      return (CLASSICS.has(place.id) ? 0.12 : 0) + (place.live?.campus ? -0.12 : 0);
    case 'newcomer':
      return (CLASSICS.has(place.id) ? 0.06 : 0) + (place.tags.includes('Small events') ? 0.04 : 0);
    default:
      return 0;
  }
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

function buildReasons(place: Place, req: RecRequest, ctx: RecContext, budget: PriceTier, now: Date): string[] {
  const reasons: string[] = [];
  const members = ctx.members;
  const moreTags = new Set(req.feedback?.moreTags ?? []);

  if (place.live) {
    const startMs = Date.parse(place.live.startsAt);
    const mins = Math.round((startMs - now.getTime()) / 60_000);
    const onToday = bostonParts(new Date(Math.max(startMs, now.getTime()))).date === bostonParts(now).date;
    if (place.live.openHours) reasons.push(mins <= 0 && onToday ? 'Open now' : 'Limited run');
    else if (!onToday) reasons.push('One-time event');
    else if (mins <= 0) reasons.push('Happening now');
    else if (mins <= 90) reasons.push(`Starts in ${mins} min`);
    else reasons.push('Only on today');
  }

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

  const me = members.find((m) => m.id === ctx.selfId) ?? members[0];
  if (me?.persona === 'student' && place.live?.source === 'localist') reasons.push('Campus event');
  if (me?.persona === 'local' && place.tags.includes('Locally owned') && !TOURIST_TRAPS.has(place.id)) reasons.push("A locals' pick");
  if ((me?.persona === 'visitor' || me?.persona === 'newcomer') && CLASSICS.has(place.id)) reasons.push('A Boston classic');

  if (place.neighborhood === 'greater') {
    reasons.push(`${place.live?.area ?? 'Greater Boston'}, on the T`);
  } else if (req.location === 'anywhere') {
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
