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
  it('onboard → recommend → crew → rate → post → keep group → group recs', async () => {
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

  it('two real people picking the same spot land in the same crew', async () => {
    const a = await signup('Ana A', 'ana_a', 'a@test.dev');
    const b = await signup('Ben B', 'ben_b', 'b@test.dev');
    const req1 = { location: 'cambridge', type: 'activity', price: 'free', duration: 'short', groupMode: true };
    const pa = await request(app).post('/api/plans').set('Authorization', `Bearer ${a}`).send({ placeId: 'pandemonium', request: req1 });
    const pb = await request(app).post('/api/plans').set('Authorization', `Bearer ${b}`).send({ placeId: 'pandemonium', request: req1 });
    expect(pb.body.groupId).toBe(pa.body.groupId);
  });

  it('saving a place from the feed boosts it', async () => {
    const token = await signup();
    const feed = await request(app).get('/api/feed').set('Authorization', `Bearer ${token}`);
    const post = feed.body[0];
    const r = await request(app)
      .post(`/api/feed/${post.id}/react`)
      .set('Authorization', `Bearer ${token}`)
      .send({ kind: 'want' });
    expect(r.body.wantedByMe).toBe(true);
  });
});
