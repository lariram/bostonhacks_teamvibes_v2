import crypto from 'node:crypto';
import { NEIGHBORHOOD_BY_ID, PRICE_TIERS, priceRank } from './data/meta.js';
import { PLACE_BY_ID } from './data/places.js';
import { DEMO_LOCALS } from './data/seedUsers.js';
import { Db, newId } from './db.js';
import { companionScore, type TasteProfile } from './recommender.js';
import type { Group, Place, PriceTier, User } from './types.js';

// ───────────── auth ─────────────

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

export function createSession(db: Db, userId: string): string {
  const token = crypto.randomBytes(24).toString('hex');
  db.data.sessions[token] = userId;
  db.save();
  return token;
}

// ───────────── shaping data for the client ─────────────

export type PublicUser = Pick<User, 'id' | 'fullName' | 'username' | 'age' | 'bio' | 'school' | 'avatarColor' | 'preferences'> & {
  firstName: string;
  isDemo?: boolean;
};

export function publicUser(u: User): PublicUser {
  return {
    id: u.id,
    fullName: u.fullName,
    firstName: u.fullName.split(' ')[0],
    username: u.username,
    age: u.age,
    bio: u.bio,
    school: u.school,
    avatarColor: u.avatarColor,
    preferences: u.preferences,
    isDemo: u.isDemo,
  };
}

export function selfUser(u: User) {
  const { passwordHash: _omit, ...rest } = u;
  return { ...rest, firstName: u.fullName.split(' ')[0] };
}

// ───────────── taste profiles ─────────────

export function allPrefs(u: User): Set<string> {
  return new Set([...u.preferences.food, ...u.preferences.event, ...u.preferences.activity]);
}

export function profileFor(db: Db, u: User): TasteProfile {
  const done = new Set(db.data.plans.filter((p) => p.userId === u.id && p.status === 'completed').map((p) => p.placeId));
  // Demo locals have "done" whatever their crews have done
  for (const g of db.data.groups) {
    if (g.memberIds.includes(u.id)) for (const a of g.activities) if (u.isDemo) done.add(a.placeId);
  }
  return {
    id: u.id,
    firstName: u.fullName.split(' ')[0],
    prefs: allPrefs(u),
    weights: u.tagWeights,
    doneIds: done,
    wantIds: new Set(u.wantIds),
    budget: u.lastPrice,
  };
}

export function communityRatings(db: Db): Record<string, { avg: number; count: number }> {
  const sums: Record<string, { total: number; count: number }> = {};
  const add = (placeId: string, rating: number) => {
    sums[placeId] ??= { total: 0, count: 0 };
    sums[placeId].total += rating;
    sums[placeId].count += 1;
  };
  for (const p of db.data.plans) if (p.status === 'completed' && p.rating) add(p.placeId, p.rating);
  // seeded posts don't have plans behind them
  for (const post of db.data.posts) if (!post.planId) add(post.placeId, post.rating);
  return Object.fromEntries(
    Object.entries(sums).map(([id, s]) => [id, { avg: Math.round((s.total / s.count) * 10) / 10, count: s.count }]),
  );
}

/** Nudge a user's tag weights. Positive = more like this, negative = less. */
export function learn(u: User, tags: string[], delta: number) {
  for (const t of tags) {
    u.tagWeights[t] = Math.max(-1, Math.min(1, Math.round(((u.tagWeights[t] ?? 0) + delta) * 100) / 100));
  }
}

/** A 5★ rating pushes a place's tags up; 1★ pushes them down; 3★ is neutral. */
export function learnFromRating(u: User, place: Place, rating: number) {
  learn(u, place.tags, (rating - 3) * 0.15);
}

// ───────────── crews & groups ─────────────

const CREW_WINDOW_MS = 6 * 60 * 60 * 1000;
const MAX_CREW = 6;

/**
 * Called when someone opts into "form a group" and picks a place.
 * 1. If a crew is already forming for the same place recently, join it
 *    (this is how two real users get matched).
 * 2. Otherwise start a new crew and invite 2–3 compatible locals.
 */
export function matchCrew(db: Db, user: User, place: Place, random: () => number = Math.random): Group {
  const now = Date.now();
  const existing = db.data.groups.find(
    (g) =>
      g.status === 'forming' &&
      g.originPlaceId === place.id &&
      !g.memberIds.includes(user.id) &&
      g.memberIds.length < MAX_CREW &&
      now - Date.parse(g.createdAt) < CREW_WINDOW_MS,
  );
  if (existing) {
    existing.memberIds.push(user.id);
    systemMessage(db, existing.id, `${firstName(user)} joined the crew 👋`);
    db.save();
    return existing;
  }

  const me = { ...profileFor(db, user), age: user.age };
  const locals = db.data.users
    .filter((u) => u.isDemo)
    .map((u) => ({ u, score: companionScore(place, { ...profileFor(db, u), age: u.age }, me) + random() * 0.15 }))
    .sort((a, b) => b.score - a.score);
  const size = 2 + Math.floor(random() * 2); // 2 or 3 companions
  const companions = locals.slice(0, size).map((x) => x.u);

  const group: Group = {
    id: newId('grp'),
    name: crewName(place, random),
    memberIds: [user.id, ...companions.map((c) => c.id)],
    status: 'forming',
    originPlaceId: place.id,
    activities: [{ placeId: place.id, byUserId: user.id, at: new Date().toISOString() }],
    createdAt: new Date().toISOString(),
  };
  db.data.groups.push(group);

  systemMessage(db, group.id, `Crew formed for ${place.name} ${place.emoji}. Meet up and say hi!`);
  companions.forEach((c, i) => {
    const hello = DEMO_LOCALS.find((d) => d.id === c.id)?.hello ?? 'hey everyone!';
    db.data.messages.push({
      id: newId('msg'),
      groupId: group.id,
      userId: c.id,
      text: hello,
      at: new Date(Date.now() + (i + 1) * 1000).toISOString(),
    });
  });
  db.save();
  return group;
}

const CREW_PREFIXES = ['Wicked', 'Green Line', 'Cobblestone', 'Harbor', 'Duckling', 'Dunks Run', 'Townie', 'Swan Boat', 'Fluffernutter', 'Pahk the Cah'];
const CREW_SUFFIXES = ['Crew', 'Squad', 'Club', 'Gang', 'Society'];

function crewName(place: Place, random: () => number): string {
  const hood = NEIGHBORHOOD_BY_ID[place.neighborhood].label.replace(' Boston', '');
  const prefix = CREW_PREFIXES[Math.floor(random() * CREW_PREFIXES.length)];
  const suffix = CREW_SUFFIXES[Math.floor(random() * CREW_SUFFIXES.length)];
  return random() < 0.5 ? `The ${prefix} ${suffix}` : `${hood} ${prefix} ${suffix}`;
}

export function systemMessage(db: Db, groupId: string, text: string) {
  db.data.messages.push({ id: newId('msg'), groupId, userId: 'system', text, at: new Date().toISOString() });
}

const firstName = (u: User) => u.fullName.split(' ')[0];

export function groupMembers(db: Db, g: Group): User[] {
  return g.memberIds.map((id) => db.user(id)).filter((u): u is User => !!u);
}

export function groupBudget(members: User[]): PriceTier {
  const rank = Math.min(...members.map((m) => priceRank(m.lastPrice ?? '40plus')));
  return PRICE_TIERS[rank].id;
}

/** The "group profile": who's in it and what they have in common. */
export function groupProfile(db: Db, g: Group) {
  const members = groupMembers(db, g);
  const counts: Record<string, User[]> = {};
  for (const m of members) for (const t of allPrefs(m)) (counts[t] ??= []).push(m);
  const sharedInterests = Object.entries(counts)
    .filter(([, who]) => who.length >= 2)
    .map(([tag, who]) => ({
      tag,
      who: who.map((m) => m.fullName.split(' ')[0]),
      whoIds: who.map((m) => m.id),
      everyone: who.length === members.length,
    }))
    .sort((a, b) => b.who.length - a.who.length);

  return {
    ...g,
    members: members.map(publicUser),
    sharedInterests,
    budget: groupBudget(members),
    activities: g.activities.map((a) => ({ ...a, place: PLACE_BY_ID[a.placeId] })).reverse(),
    origin: PLACE_BY_ID[g.originPlaceId],
  };
}
