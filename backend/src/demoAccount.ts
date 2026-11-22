// A ready-made demo account: two weeks of history, a group, a shared day, saved
// spots and people followed, so the app can be shown without onboarding.

import type { Db } from './db.js';
import { newId } from './db.js';
import { bostonParts, bostonWallTime } from './live/time.js';
import { learnFromRating, systemMessage } from './services.js';
import type { FeedPost, Group, Place, Plan, User } from './types.js';

type Stop = [placeId: string, hour: number, minute: number, rating: number];

/** Days ago → stops (in order) */
const HISTORY: { daysAgo: number; stops: Stop[]; group?: boolean; post?: { index: number; caption: string } }[] = [
  { daysAgo: 12, stops: [['harvard-art', 13, 0, 4], ['sofra', 15, 0, 5]] },
  { daysAgo: 9, stops: [['bunker-hill', 11, 0, 4], ['warren-tavern', 12, 30, 4]] },
  {
    daysAgo: 6,
    group: true,
    stops: [['mfa', 11, 0, 5], ['time-out-market', 13, 30, 4], ['fens', 15, 0, 4]],
    post: { index: 0, caption: 'The Art of the Americas wing is unreal. Met the best people here.' },
  },
  { daysAgo: 4, stops: [['ica', 14, 0, 5], ['flour', 16, 0, 4]], post: { index: 0, caption: 'Free Thursday nights at the ICA!' } },
  { daysAgo: 2, stops: [['bow-market', 12, 0, 4], ['diesel', 14, 0, 5]] },
  // yesterday: shared as a whole day
  { daysAgo: 1, stops: [['paul-revere-house', 10, 30, 5], ['modern-pastry', 12, 0, 5], ['freedom-trail', 13, 0, 4], ['quincy-market', 15, 30, 3]] },
];
/** Today so far: done, and saved for the end-of-day post */
const TODAY: Stop[] = [['chinatown-gate', 10, 30, 5], ['gourmet-dumpling', 12, 0, 5]];

export function seedDemoAccount(db: Db, user: User, getPlace: (id: string) => Place | undefined, now: Date) {
  Object.assign(user, {
    fullName: 'Alex Rivera',
    bio: 'Sophomore. Collecting T stops and cannoli.',
    school: 'Boston University',
    persona: 'student',
    preferences: { food: ['Italian', 'Dessert', 'Chinese'], event: ['Live music', 'Comedy'], activity: ['Museums', 'History', 'Nature'] },
    lastPrice: '10to20',
    wantIds: ['mapparium', 'neptune-oyster', 'brattle-theatre'],
    following: ['demo-maya', 'demo-priya', 'demo-jordan'].filter((id) => db.user(id)),
  } satisfies Partial<User>);

  const day = (daysAgo: number) => bostonParts(new Date(now.getTime() - daysAgo * 86_400_000)).date;
  const addPlan = (placeId: string, date: string, h: number, m: number, rating: number | null, extra: Partial<Plan> = {}) => {
    const place = getPlace(placeId);
    if (!place) return null;
    const start = bostonWallTime(date, h, m);
    const end = new Date(start.getTime() + Math.min(place.minutes, 120) * 60_000);
    const plan: Plan = {
      id: newId('plan'),
      userId: user.id,
      placeId,
      request: { location: place.neighborhood, type: place.type, price: '20to40', durationMinutes: Math.min(place.minutes, 120), startAt: start.toISOString() },
      status: rating ? 'completed' : 'active',
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      rating: rating ?? undefined,
      createdAt: new Date(start.getTime() - 3_600_000).toISOString(),
      completedAt: rating ? end.toISOString() : undefined,
      ...extra,
    };
    db.data.plans.push(plan);
    if (rating) learnFromRating(user, place, rating);
    return plan;
  };

  for (const h of HISTORY) {
    const date = day(h.daysAgo);
    let group: Group | undefined;
    if (h.group) {
      const members = ['demo-maya', 'demo-jordan'].filter((id) => db.user(id));
      group = {
        id: newId('grp'),
        name: 'Museum Saturdays',
        memberIds: [user.id, ...members],
        status: 'active',
        originPlaceId: h.stops[0][0],
        activities: [],
        createdAt: bostonWallTime(date, h.stops[0][1], 0).toISOString(),
      };
      db.data.groups.push(group);
      systemMessage(db, group.id, 'Group formed at the Museum of Fine Arts. Meet up and say hi!');
    }
    const plans = h.stops.map(([id, hr, mn, r]) => addPlan(id, date, hr, mn, r, group ? { groupId: group.id } : {})).filter((p): p is Plan => !!p);
    if (group)
      for (const p of plans) group.activities.unshift({ placeId: p.placeId, byUserId: user.id, at: p.startsAt! });
    if (group && db.user('demo-maya'))
      db.data.messages.push({ id: newId('msg'), groupId: group.id, userId: 'demo-maya', text: 'same time next week?? the Gardner is calling', at: plans[plans.length - 1].endsAt! });
    if (h.post) {
      const p = plans[h.post.index];
      const post: FeedPost = {
        id: newId('post'),
        userId: user.id,
        placeId: p.placeId,
        planId: p.id,
        rating: p.rating!,
        caption: h.post.caption,
        groupId: group?.id,
        likes: ['demo-maya', 'demo-priya'].filter((id) => db.user(id)),
        wants: [],
        createdAt: p.completedAt!,
      };
      db.data.posts.push(post);
      p.postId = post.id;
    }
    if (h.daysAgo === 1) {
      db.data.posts.push({
        id: newId('post'),
        userId: user.id,
        placeId: plans[0].placeId,
        rating: 4,
        caption: 'Freedom Trail day with a cannoli break. Ten out of ten would walk again.',
        likes: ['demo-jordan', 'demo-diego', 'demo-sam'].filter((id) => db.user(id)),
        wants: [],
        day: { date, stops: plans.map((p) => ({ planId: p.id, placeId: p.placeId, rating: p.rating!, at: p.startsAt! })) },
        createdAt: plans[plans.length - 1].completedAt!,
      });
    }
  }

  // today: two stops done (saved for the day post) and one coming up
  const today = day(0);
  // place them a few hours before now (or at their usual times if it's very early)
  TODAY.forEach(([id, h, m, r], i) => {
    const at = new Date(Math.floor((now.getTime() - (3 - i * 1.5) * 3_600_000) / 1_800_000) * 1_800_000);
    const p = bostonParts(at);
    if (p.date === today) addPlan(id, today, p.hour, p.minute, r, { shareLater: true });
    else addPlan(id, today, h, m, r, { shareLater: true });
  });
  const later = new Date(Math.ceil((now.getTime() + 2 * 3_600_000) / 1_800_000) * 1_800_000);
  const lp = bostonParts(later);
  addPlan('boston-common', lp.date, lp.hour, lp.minute, null);
}
