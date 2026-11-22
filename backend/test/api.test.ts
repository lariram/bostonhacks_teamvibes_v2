import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { Db } from '../src/db.js';

let app: ReturnType<typeof createApp>;
let seq = 0;
const rand = () => {
  // deterministic pseudo-random
  seq = (seq * 9301 + 49297) % 233280;
  return seq / 233280;
};

beforeEach(() => {
  seq = 1;
  app = createApp(new Db(null), { random: rand, now: () => new Date('2026-11-21T18:00:00') });
});

async function signup(name = 'Lari Test', username = 'laritest', email = 'lari@test.dev') {
  const res = await request(app)
    .post('/api/auth/signup')
    .send({ fullName: name, age: 21, username, email, password: 'boston123' });
  expect(res.status).toBe(200);
  return res.body.token as string;
}

describe('auth', () => {
  it('signs up, logs in, rejects bad passwords', async () => {
    await signup();
    const ok = await request(app).post('/api/auth/login').send({ email: 'lari@test.dev', password: 'boston123' });
    expect(ok.status).toBe(200);
    const bad = await request(app).post('/api/auth/login').send({ email: 'lari@test.dev', password: 'nope' });
    expect(bad.status).toBe(401);
  });

  it('guest mode logs in with one tap', async () => {
    const res = await request(app).post('/api/auth/guest');
    expect(res.status).toBe(200);
    const me = await request(app).get('/api/me').set('Authorization', `Bearer ${res.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.isGuest).toBe(true);
    // a second guest gets a separate account
    const again = await request(app).post('/api/auth/guest');
    expect(again.body.user.id).not.toBe(res.body.user.id);
  });

  it('requires 18+', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ fullName: 'Kid', age: 16, username: 'kiddo', email: 'kid@test.dev', password: 'boston123' });
    expect(res.status).toBe(400);
  });

  it('protects private routes', async () => {
    expect((await request(app).get('/api/me')).status).toBe(401);
  });
});

describe('full day flow', () => {
  it('onboard → recommend → group → rate → post → keep group → group recs', async () => {
    const token = await signup();
    const authed = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);

    // onboarding preferences (max 3 per category, unknown tags dropped)
    const prefs = await authed(request(app).put('/api/me/preferences')).send({
      food: ['Chinese', 'Dessert', 'Italian', 'Greek', 'NotATag'],
      event: ['Live music'],
      activity: ['Nature'],
    });
    expect(prefs.body.user.preferences.food).toEqual(['Chinese', 'Dessert', 'Italian']);

    // two suggestions
    const req1 = { location: 'northend', type: 'food', price: '10to20', duration: 'short', timeOfDay: 'evening', groupMode: true };
    const recs = await authed(request(app).post('/api/recommendations')).send(req1);
    expect(recs.status).toBe(200);
    expect(recs.body.suggestions).toHaveLength(2);

    // pick one with group mode on → a crew forms
    const pick = recs.body.suggestions[0].place.id;
    const plan = await authed(request(app).post('/api/plans')).send({ placeId: pick, request: req1 });
    expect(plan.status).toBe(200);
    expect(plan.body.group).toBeTruthy();
    expect(plan.body.group.members.length).toBeGreaterThanOrEqual(3);
    expect(plan.body.group.status).toBe('forming');

    // crew chat has intros
    const msgs = await authed(request(app).get(`/api/groups/${plan.body.groupId}/messages`));
    expect(msgs.body.length).toBeGreaterThan(1);

    // plain default name, and any member can rename it
    expect(plan.body.group.name).toBe(`${recs.body.suggestions[0].place.name} group`);
    const renamed = await authed(request(app).patch(`/api/groups/${plan.body.groupId}`)).send({ name: '  Friday   dinner ' });
    expect(renamed.body.name).toBe('Friday dinner');
    const blank = await authed(request(app).patch(`/api/groups/${plan.body.groupId}`)).send({ name: '   ' });
    expect(blank.status).toBe(400);
    const msgs2 = await authed(request(app).get(`/api/groups/${plan.body.groupId}/messages`));
    expect(msgs2.body.some((m: any) => m.text.includes('renamed the group to "Friday dinner"'))).toBe(true);

    // finish + rate + post publicly; review stays private
    const done = await authed(request(app).post(`/api/plans/${plan.body.id}/complete`)).send({
      rating: 5,
      review: 'private thoughts',
      postToFeed: true,
      caption: 'so good',
    });
    expect(done.body.status).toBe('completed');
    const feed = await authed(request(app).get('/api/feed'));
    const mine = feed.body.find((p: any) => p.mine);
    expect(mine.caption).toBe('so good');
    expect(JSON.stringify(feed.body)).not.toContain('private thoughts');

    // keep the crew → group profile
    const kept = await authed(request(app).post(`/api/groups/${plan.body.groupId}/keep`)).send({});
    expect(kept.body.status).toBe('active');
    expect(kept.body.sharedInterests).toBeInstanceOf(Array);

    // group recommendations respect every member's budget and skip where we've been
    const groupRecs = await authed(request(app).post('/api/recommendations')).send({
      location: 'northend',
      type: 'food',
      price: '40plus',
      duration: 'short',
      groupId: plan.body.groupId,
    });
    expect(groupRecs.status).toBe(200);
    expect(groupRecs.body.suggestions.map((s: any) => s.place.id)).not.toContain(pick);
    expect(groupRecs.body.budget).toBe(kept.body.budget);

    // profile shows the group and bingo progress
    const me = await authed(request(app).get('/api/me'));
    expect(me.body.stats.completed).toBe(1);
    expect(me.body.bingo.find((b: any) => b.id === 'northend').visited).toBe(true);
    expect(me.body.user.passwordHash).toBeUndefined();
  });

  it('two real people picking the same spot land in the same group', async () => {
    const a = await signup('Ana A', 'ana_a', 'a@test.dev');
    const b = await signup('Ben B', 'ben_b', 'b@test.dev');
    const req1 = { location: 'cambridge', type: 'activity', price: 'free', duration: 'short', groupMode: true };
    const pa = await request(app).post('/api/plans').set('Authorization', `Bearer ${a}`).send({ placeId: 'pandemonium', request: req1 });
    const pb = await request(app).post('/api/plans').set('Authorization', `Bearer ${b}`).send({ placeId: 'pandemonium', request: req1 });
    expect(pb.body.groupId).toBe(pa.body.groupId);
  });

  it('saving a place from the feed boosts it', async () => {
    const token = await signup();
    const feed = await request(app).get('/api/feed?scope=everyone').set('Authorization', `Bearer ${token}`);
    const post = feed.body[0];
    const r = await request(app)
      .post(`/api/feed/${post.id}/react`)
      .set('Authorization', `Bearer ${token}`)
      .send({ kind: 'want' });
    expect(r.body.wantedByMe).toBe(true);
  });
});

describe('following, feed and saved', () => {
  it('follow people: the feed leads with them; everyone is one tab away', async () => {
    const token = await signup();
    const authed = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
    expect((await authed(request(app).get('/api/feed'))).body).toHaveLength(0); // following no one yet
    const everyone = (await authed(request(app).get('/api/feed?scope=everyone'))).body;
    expect(everyone.length).toBeGreaterThan(3);

    const maya = everyone.find((p: any) => p.user.firstName === 'Maya').user.id;
    const suggested = (await authed(request(app).get('/api/people/suggested'))).body;
    expect(suggested.length).toBeGreaterThan(0);
    expect((await authed(request(app).post(`/api/users/${maya}/follow`))).body.following).toBe(true);

    const feed = (await authed(request(app).get('/api/feed'))).body;
    expect(feed.length).toBeGreaterThan(0);
    expect(feed.every((p: any) => p.user.id === maya)).toBe(true);
    expect(feed[0].following).toBe(true);

    const profile = (await authed(request(app).get(`/api/users/${maya}`))).body;
    expect(profile.following).toBe(true);
    expect(profile.followers).toBe(1);
    expect((await authed(request(app).post(`/api/users/${maya}/follow`))).body.following).toBe(false); // toggle off
  });

  it('saved spots show up in one place and can be removed', async () => {
    const token = await signup();
    const authed = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
    expect((await authed(request(app).post('/api/saved/gardner'))).body.saved).toBe(true);
    const saved = (await authed(request(app).get('/api/saved'))).body;
    expect(saved.map((s: any) => s.place.id)).toEqual(['gardner']);
    expect(saved[0].planned).toBe(false);
    await authed(request(app).post('/api/plans')).send({
      placeId: 'gardner',
      request: { location: 'fenway', type: 'activity', price: '40plus', durationMinutes: 120, startAt: '2026-11-22T15:00:00Z' },
    });
    expect((await authed(request(app).get('/api/saved'))).body[0].planned).toBe(true);
    expect((await authed(request(app).post('/api/saved/gardner'))).body.saved).toBe(false);
  });
});

describe('share your day', () => {
  it('turns a finished day of stops into one feed post', async () => {
    const token = (await request(app).post('/api/auth/guest')).body.token as string;
    const authed = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
    const { bostonParts } = await import('../src/live/time.js');

    const plans = [];
    for (const [placeId, rating] of [['regina', 5], ['freedom-trail', 4], ['mikes-pastry', 3]] as const) {
      const plan = await authed(request(app).post('/api/plans')).send({ placeId });
      await authed(request(app).post(`/api/plans/${plan.body.id}/complete`)).send({ rating });
      plans.push(plan.body);
    }
    const date = bostonParts(new Date(plans[0].startsAt ?? plans[0].createdAt)).date;

    const day = await authed(request(app).get(`/api/day?date=${date}`));
    expect(day.body.stops.map((s: any) => s.place.id)).toEqual(['regina', 'freedom-trail', 'mikes-pastry']);
    expect(day.body.sharedPostId).toBeNull();

    const shared = await authed(request(app).post('/api/day/share')).send({ date, caption: 'North End crawl' });
    expect(shared.status).toBe(200);
    // sharing again updates the same post instead of adding another
    const again = await authed(request(app).post('/api/day/share')).send({ date, caption: 'Best Saturday' });
    expect(again.body.id).toBe(shared.body.id);

    const feed = await authed(request(app).get('/api/feed'));
    const posts = feed.body.filter((p: any) => p.day);
    expect(posts).toHaveLength(1);
    expect(posts[0].caption).toBe('Best Saturday');
    expect(posts[0].day.stops.map((s: any) => s.place.id)).toEqual(['regina', 'freedom-trail', 'mikes-pastry']);
    expect(posts[0].rating).toBe(4);
  });

  it('needs at least two finished stops', async () => {
    const token = (await request(app).post('/api/auth/guest')).body.token as string;
    const res = await request(app).post('/api/day/share').set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(400);
  });
});

describe('demo account', () => {
  it('logs in with history, a group, a shared day and bingo already filled in', async () => {
    const res = await request(app).post('/api/auth/demo');
    expect(res.status).toBe(200);
    const authed = (r: request.Test) => r.set('Authorization', `Bearer ${res.body.token}`);
    const me = await authed(request(app).get('/api/me'));
    expect(me.body.user.fullName).toBe('Alex Rivera');
    expect(me.body.user.persona).toBe('student');
    expect(me.body.stats.completed).toBeGreaterThanOrEqual(15);
    expect(me.body.bingo.filter((b: any) => b.visited).length).toBeGreaterThanOrEqual(6);
    expect(me.body.tStops.visited).toBeGreaterThanOrEqual(8);
    const history = await authed(request(app).get('/api/history'));
    expect(history.body.some((p: any) => p.status === 'active')).toBe(true);
    const groups = await authed(request(app).get('/api/groups'));
    expect(groups.body[0].status).toBe('active');
    const feed = await authed(request(app).get('/api/feed'));
    expect(feed.body.some((p: any) => p.mine && p.day)).toBe(true);
    // today's stops are waiting for the end-of-day post
    const day = await authed(request(app).get('/api/day'));
    expect(day.body.savedForLater).toBe(2);
  });
});

describe('save for the end-of-day post', () => {
  it('keeps a stop off the feed until the day is shared', async () => {
    const token = (await request(app).post('/api/auth/guest')).body.token as string;
    const authed = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
    const plan = await authed(request(app).post('/api/plans')).send({ placeId: 'regina' });
    await authed(request(app).post(`/api/plans/${plan.body.id}/complete`)).send({ rating: 5, shareMode: 'later' });
    const feed = await authed(request(app).get('/api/feed'));
    expect(feed.body.filter((p: any) => p.mine)).toHaveLength(0);
    const { bostonParts } = await import('../src/live/time.js');
    const date = bostonParts(new Date(plan.body.startsAt)).date;
    const day = await authed(request(app).get(`/api/day?date=${date}`));
    expect(day.body.savedForLater).toBe(1);
  });
});
