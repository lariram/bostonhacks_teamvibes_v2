import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import {
  DURATIONS,
  MAX_PREFS_PER_CATEGORY,
  NEIGHBORHOODS,
  NEIGHBORHOOD_BY_ID,
  PREFERENCE_TAGS,
  PRICE_TIERS,
  TIMES_OF_DAY,
  TYPES,
  AVATAR_COLORS,
  DURATION_OPTIONS,
  PERSONAS,
} from './data/meta.js';
import { Catalog } from './catalog.js';
import { PLACES } from './data/places.js';
import type { LiveEvents } from './live/liveEvents.js';
import { Db, newId } from './db.js';
import { recommend } from './recommender.js';
import {
  communityRatings,
  createSession,
  groupMembers,
  groupProfile,
  hashPassword,
  learn,
  learnFromRating,
  matchCrew,
  profileFor,
  publicUser,
  selfUser,
  systemMessage,
  verifyPassword,
} from './services.js';
import type { Plan, PlaceType, Preferences, RecRequest, User } from './types.js';

type AuthedRequest = Request & { user: User };

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
const fail = (status: number, message: string): never => {
  throw new HttpError(status, message);
};

export interface AppOptions {
  random?: () => number;
  now?: () => Date;
  /** Today's real events; omit for catalog-only (tests, offline) */
  live?: LiveEvents | null;
}

export function createApp(db: Db, opts: AppOptions = {}) {
  const random = opts.random ?? Math.random;
  const now = opts.now ?? (() => new Date());
  const catalog = new Catalog(db, opts.live ?? null);
  const placeOf = (id: string) => catalog.get(id);
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '100kb' }));

  // Wrap handlers so thrown errors become JSON responses
  const h =
    (fn: (req: AuthedRequest, res: Response) => unknown) =>
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const out = fn(req as AuthedRequest, res);
        if (out !== undefined && !res.headersSent) res.json(out);
      } catch (err) {
        next(err);
      }
    };

  const auth = (req: Request, _res: Response, next: NextFunction) => {
    const token = req.header('authorization')?.replace(/^Bearer\s+/i, '');
    const userId = token ? db.data.sessions[token] : undefined;
    const user = userId ? db.user(userId) : undefined;
    if (!user) return next(new HttpError(401, 'Please log in'));
    (req as AuthedRequest).user = user;
    next();
  };

  // ───────────── meta ─────────────
  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.get(
    '/api/meta',
    h(() => ({
      neighborhoods: NEIGHBORHOODS.map(({ id, label }) => ({ id, label })),
      types: TYPES,
      priceTiers: PRICE_TIERS,
      durations: DURATIONS.map(({ id, label }) => ({ id, label })),
      durationOptions: DURATION_OPTIONS,
      personas: PERSONAS,
      timesOfDay: TIMES_OF_DAY,
      preferenceTags: PREFERENCE_TAGS,
      maxPrefsPerCategory: MAX_PREFS_PER_CATEGORY,
      placeCount: PLACES.length,
    })),
  );

  // ───────────── auth ─────────────
  app.post(
    '/api/auth/signup',
    h((req) => {
      const { fullName, age, username, email, password } = req.body ?? {};
      const cleanEmail = String(email ?? '').trim().toLowerCase();
      const cleanUsername = String(username ?? '').trim().replace(/^@/, '');
      if (!String(fullName ?? '').trim()) fail(400, 'Please enter your name');
      if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) fail(400, 'Please enter a valid email');
      if (!/^[a-zA-Z0-9_.]{3,24}$/.test(cleanUsername)) fail(400, 'Usernames are 3–24 letters, numbers, _ or .');
      const ageNum = Number(age);
      if (!Number.isInteger(ageNum) || ageNum < 18 || ageNum > 120)
        fail(400, 'You need to be 18+ to meet up with groups');
      if (String(password ?? '').length < 6) fail(400, 'Password must be at least 6 characters');
      if (db.data.users.some((u) => u.email === cleanEmail)) fail(409, 'That email already has an account');
      if (db.data.users.some((u) => u.username.toLowerCase() === cleanUsername.toLowerCase()))
        fail(409, 'That username is taken');

      const user: User = {
        id: newId('usr'),
        fullName: String(fullName).trim(),
        username: cleanUsername,
        email: cleanEmail,
        age: ageNum,
        passwordHash: hashPassword(String(password)),
        preferences: { food: [], event: [], activity: [] },
        tagWeights: {},
        wantIds: [],
        avatarColor: AVATAR_COLORS[Math.floor(random() * AVATAR_COLORS.length)],
        createdAt: now().toISOString(),
      };
      db.data.users.push(user);
      return { token: createSession(db, user.id), user: selfUser(user) };
    }),
  );

  // One tap, no form: for demos and judges. Guest accounts can't log back in after logging out.
  app.post(
    '/api/auth/guest',
    h(() => {
      const tag = newId('g').slice(-6);
      const user: User = {
        id: newId('usr'),
        fullName: 'Guest Rider',
        username: `guest_${tag}`,
        email: `guest_${tag}@guest.local`,
        age: 21,
        passwordHash: '',
        isGuest: true,
        preferences: { food: [], event: [], activity: [] },
        tagWeights: {},
        wantIds: [],
        avatarColor: AVATAR_COLORS[Math.floor(random() * AVATAR_COLORS.length)],
        createdAt: now().toISOString(),
      };
      db.data.users.push(user);
      return { token: createSession(db, user.id), user: selfUser(user) };
    }),
  );

  app.post(
    '/api/auth/login',
    h((req) => {
      const email = String(req.body?.email ?? '').trim().toLowerCase();
      const user = db.data.users.find((u) => u.email === email && !u.isDemo && !u.isGuest);
      if (!user || !verifyPassword(String(req.body?.password ?? ''), user.passwordHash))
        fail(401, 'Email or password is incorrect');
      return { token: createSession(db, user!.id), user: selfUser(user!) };
    }),
  );

  app.post(
    '/api/auth/logout',
    auth,
    h((req) => {
      const token = req.header('authorization')?.replace(/^Bearer\s+/i, '');
      if (token) delete db.data.sessions[token];
      db.save();
      return { ok: true };
    }),
  );

  // ───────────── me ─────────────
  app.get(
    '/api/me',
    auth,
    h((req) => {
      const u = req.user;
      const completed = db.data.plans.filter((p) => p.userId === u.id && p.status === 'completed');
      const visited = new Set(completed.map((p) => placeOf(p.placeId)?.neighborhood).filter(Boolean));
      const groups = db.data.groups.filter((g) => g.memberIds.includes(u.id) && g.status !== 'ended');
      const topTags = Object.entries(u.tagWeights)
        .filter(([, w]) => w > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tag]) => tag);
      return {
        user: selfUser(u),
        stats: {
          completed: completed.length,
          avgRating: completed.length
            ? Math.round((completed.reduce((a, p) => a + (p.rating ?? 0), 0) / completed.length) * 10) / 10
            : null,
          posts: db.data.posts.filter((p) => p.userId === u.id).length,
          groups: groups.length,
        },
        // "Boston Bingo": which neighborhoods you've explored
        bingo: NEIGHBORHOODS.map((n) => ({ id: n.id, label: n.label, visited: visited.has(n.id) })),
        learnedFavorites: topTags,
      };
    }),
  );

  app.put(
    '/api/me/preferences',
    auth,
    h((req) => {
      const body = req.body ?? {};
      const prefs: Preferences = { food: [], event: [], activity: [] };
      for (const cat of ['food', 'event', 'activity'] as PlaceType[]) {
        const picked: unknown[] = Array.isArray(body[cat]) ? body[cat] : [];
        prefs[cat] = picked
          .map(String)
          .filter((t) => PREFERENCE_TAGS[cat].includes(t))
          .slice(0, MAX_PREFS_PER_CATEGORY);
      }
      req.user.preferences = prefs;
      db.save();
      return { user: selfUser(req.user) };
    }),
  );

  app.patch(
    '/api/me',
    auth,
    h((req) => {
      const { bio, school, persona } = req.body ?? {};
      if (PERSONAS.some((p) => p.id === persona)) req.user.persona = persona;
      if (typeof bio === 'string') req.user.bio = bio.slice(0, 160);
      if (typeof school === 'string') req.user.school = school.slice(0, 60);
      db.save();
      return { user: selfUser(req.user) };
    }),
  );

  // ───────────── recommendations ─────────────
  app.post(
    '/api/recommendations',
    auth,
    h((req) => {
      const r = parseRecRequest(req.body);
      const lastShown = (r.excludeIds ?? []).slice(-2).map((id) => placeOf(id)).filter((p): p is NonNullable<typeof p> => !!p);

      // Don't re-suggest what you're doing / just did today (only as a last resort)
      const dayAgo = now().getTime() - 24 * 60 * 60 * 1000;
      const recent = db.data.plans
        .filter((p) => p.userId === req.user.id && (p.status === 'active' || Date.parse(p.completedAt ?? '') > dayAgo))
        .map((p) => p.placeId);
      r.excludeIds = [...(r.excludeIds ?? []), ...recent];

      let members = [profileFor(db, req.user)];
      if (r.groupId) {
        const g = db.data.groups.find((x) => x.id === r.groupId && x.memberIds.includes(req.user.id));
        if (!g) fail(404, 'Group not found');
        members = groupMembers(db, g!).map((u) => profileFor(db, u));
        r.excludeIds.push(...g!.activities.map((a) => a.placeId));
      } else {
        // remember solo budget — used to keep group plans affordable for everyone
        req.user.lastPrice = r.price;
      }
      // Feedback from the "not quite" screen also teaches the profile a little
      if (r.feedback?.moreTags?.length) learn(req.user, r.feedback.moreTags, 0.1);
      db.save();

      const result = recommend(r, {
        places: catalog.candidates(now()),
        members,
        communityRatings: communityRatings(db),
        now: now(),
        lastShown,
        random,
        selfId: req.user.id,
      });
      opts.live?.ensureFresh(); // background; never blocks this request
      return result;
    }),
  );

  // What's on today, and how each live source is doing
  app.get(
    '/api/live',
    h(() => {
      if (!opts.live) return { date: null, total: 0, sources: [], enabled: false };
      opts.live.ensureFresh();
      const status = opts.live.status(now());
      return {
        ...status,
        enabled: true,
        upcoming: opts.live.events(now()).slice(0, 5).map((p) => ({ id: p.id, name: p.name, startsAt: p.live!.startsAt, source: p.live!.sourceName })),
      };
    }),
  );

  // ───────────── plans (a chosen recommendation) ─────────────
  app.post(
    '/api/plans',
    auth,
    h((req) => {
      const place = catalog.get(String(req.body?.placeId));
      if (!place) fail(404, 'Unknown place');
      catalog.remember(place!);
      const request = parseRecRequest(req.body?.request ?? { location: 'anywhere', type: place!.type, price: '40plus', duration: 'day' });

      let groupId: string | undefined;
      if (request.groupId) {
        const g = db.data.groups.find((x) => x.id === request.groupId && x.memberIds.includes(req.user.id));
        if (!g) fail(404, 'Group not found');
        g!.activities.push({ placeId: place!.id, byUserId: req.user.id, at: now().toISOString() });
        systemMessage(db, g!.id, `📍 ${req.user.fullName.split(' ')[0]} picked ${place!.name} ${place!.emoji}. See you there!`);
        // a demo member cheers it on so the chat feels alive
        const local = groupMembers(db, g!).find((m) => m.isDemo);
        if (local) {
          const cheers = ['omw!! 🏃', 'ooh love this pick', 'yesss, been wanting to go', "say less, I'm in", 'perfect, see you there'];
          db.data.messages.push({
            id: newId('msg'),
            groupId: g!.id,
            userId: local.id,
            text: cheers[Math.floor(random() * cheers.length)],
            at: new Date(now().getTime() + 1500).toISOString(),
          });
        }
        groupId = g!.id;
      } else if (request.groupMode) {
        groupId = matchCrew(db, req.user, place!, random).id;
      }

      const plan: Plan = {
        id: newId('plan'),
        userId: req.user.id,
        placeId: place!.id,
        request: { ...request, groupId },
        groupId,
        status: 'active',
        createdAt: now().toISOString(),
      };
      db.data.plans.push(plan);
      db.save();
      return planView(plan);
    }),
  );

  app.get(
    '/api/plans/:id',
    auth,
    h((req) => planView(ownPlan(req))),
  );

  app.post(
    '/api/plans/:id/complete',
    auth,
    h((req) => {
      const plan = ownPlan(req);
      const rating = Number(req.body?.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) fail(400, 'Pick 1–5 stars');
      const place = catalog.get(plan.placeId)!;
      const wasCompleted = plan.status === 'completed';

      plan.status = 'completed';
      plan.rating = rating;
      plan.review = typeof req.body?.review === 'string' ? req.body.review.slice(0, 2000) : undefined;
      plan.completedAt = now().toISOString();
      if (!wasCompleted) learnFromRating(req.user, place, rating);

      if (req.body?.postToFeed && !plan.postId) {
        const post = {
          id: newId('post'),
          userId: req.user.id,
          placeId: plan.placeId,
          planId: plan.id,
          rating,
          caption: typeof req.body?.caption === 'string' ? req.body.caption.slice(0, 280) : undefined,
          groupId: plan.groupId,
          likes: [],
          wants: [],
          createdAt: now().toISOString(),
        };
        db.data.posts.push(post);
        plan.postId = post.id;
      }
      if (plan.groupId && !wasCompleted) {
        systemMessage(db, plan.groupId, `✅ ${req.user.fullName.split(' ')[0]} wrapped up ${place.name}`);
      }
      db.save();
      return planView(plan);
    }),
  );

  app.get(
    '/api/history',
    auth,
    h((req) =>
      db.data.plans
        .filter((p) => p.userId === req.user.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(planView),
    ),
  );

  // ───────────── feed ─────────────
  app.get(
    '/api/feed',
    auth,
    h((req) =>
      [...db.data.posts]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 100)
        .map((p) => {
          const author = db.user(p.userId);
          const group = p.groupId ? db.data.groups.find((g) => g.id === p.groupId) : undefined;
          return {
            id: p.id,
            rating: p.rating,
            caption: p.caption,
            createdAt: p.createdAt,
            user: author ? publicUser(author) : null,
            place: catalog.get(p.placeId),
            group: group && group.status === 'active' ? { id: group.id, name: group.name, size: group.memberIds.length } : null,
            likes: p.likes.length,
            likedByMe: p.likes.includes(req.user.id),
            wantedByMe: req.user.wantIds.includes(p.placeId),
            mine: p.userId === req.user.id,
          };
        }),
    ),
  );

  app.post(
    '/api/feed/:id/react',
    auth,
    h((req) => {
      const post = db.data.posts.find((p) => p.id === req.params.id);
      if (!post) fail(404, 'Post not found');
      const place = catalog.get(post!.placeId)!;
      const kind = req.body?.kind;
      const u = req.user;
      if (kind === 'like') {
        const i = post!.likes.indexOf(u.id);
        if (i >= 0) post!.likes.splice(i, 1);
        else {
          post!.likes.push(u.id);
          learn(u, place.tags, 0.03); // reactions gently shape your recommendations
        }
      } else if (kind === 'want') {
        const i = u.wantIds.indexOf(post!.placeId);
        if (i >= 0) u.wantIds.splice(i, 1);
        else {
          u.wantIds.push(post!.placeId);
          learn(u, place.tags, 0.05);
        }
      } else fail(400, 'Unknown reaction');
      db.save();
      return { likes: post!.likes.length, likedByMe: post!.likes.includes(u.id), wantedByMe: u.wantIds.includes(post!.placeId) };
    }),
  );

  // ───────────── groups ─────────────
  app.get(
    '/api/groups',
    auth,
    h((req) =>
      db.data.groups
        .filter((g) => g.memberIds.includes(req.user.id) && g.status !== 'ended')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((g) => groupProfile(db, g, placeOf)),
    ),
  );

  app.get(
    '/api/groups/:id',
    auth,
    h((req) => groupProfile(db, memberGroup(req), placeOf)),
  );

  // "Want another activity with the same group?" → yes
  app.post(
    '/api/groups/:id/keep',
    auth,
    h((req) => {
      const g = memberGroup(req);
      if (typeof req.body?.name === 'string' && req.body.name.trim()) g.name = req.body.name.trim().slice(0, 40);
      if (g.status === 'forming') {
        g.status = 'active';
        systemMessage(db, g.id, `🎉 ${g.name} is official! Your group profile is saved under Profile.`);
      }
      db.save();
      return groupProfile(db, g, placeOf);
    }),
  );

  app.patch(
    '/api/groups/:id',
    auth,
    h((req) => {
      const g = memberGroup(req);
      if (typeof req.body?.name === 'string' && req.body.name.trim()) g.name = req.body.name.trim().slice(0, 40);
      db.save();
      return groupProfile(db, g, placeOf);
    }),
  );

  app.post(
    '/api/groups/:id/leave',
    auth,
    h((req) => {
      const g = memberGroup(req);
      g.memberIds = g.memberIds.filter((id) => id !== req.user.id);
      systemMessage(db, g.id, `${req.user.fullName.split(' ')[0]} left the group`);
      if (!g.memberIds.some((id) => !db.user(id)?.isDemo)) g.status = 'ended';
      db.save();
      return { ok: true };
    }),
  );

  // Another real member picked the next spot — hop on the same plan
  app.post(
    '/api/groups/:id/join-current',
    auth,
    h((req) => {
      const g = memberGroup(req);
      const current = g.activities[g.activities.length - 1];
      if (!current) fail(400, 'Nothing planned yet');
      const existing = db.data.plans.find(
        (p) => p.userId === req.user.id && p.groupId === g.id && p.placeId === current.placeId && p.status === 'active',
      );
      if (existing) return planView(existing);
      const place = catalog.get(current.placeId)!;
      const plan: Plan = {
        id: newId('plan'),
        userId: req.user.id,
        placeId: current.placeId,
        request: { location: place.neighborhood, type: place.type, price: place.price, duration: 'day', groupId: g.id },
        groupId: g.id,
        status: 'active',
        createdAt: now().toISOString(),
      };
      db.data.plans.push(plan);
      db.save();
      return planView(plan);
    }),
  );

  app.get(
    '/api/groups/:id/messages',
    auth,
    h((req) => {
      const g = memberGroup(req);
      return db.data.messages
        .filter((m) => m.groupId === g.id)
        .sort((a, b) => a.at.localeCompare(b.at))
        .slice(-200)
        .map((m) => {
          const u = m.userId === 'system' ? null : db.user(m.userId);
          return { ...m, user: u ? publicUser(u) : null, mine: m.userId === req.user.id };
        });
    }),
  );

  app.post(
    '/api/groups/:id/messages',
    auth,
    h((req) => {
      const g = memberGroup(req);
      const text = String(req.body?.text ?? '').trim().slice(0, 500);
      if (!text) fail(400, 'Message is empty');
      const msg = { id: newId('msg'), groupId: g.id, userId: req.user.id, text, at: now().toISOString() };
      db.data.messages.push(msg);
      db.save();
      return { ...msg, user: publicUser(req.user), mine: true };
    }),
  );

  // ───────────── helpers ─────────────
  function ownPlan(req: AuthedRequest): Plan {
    const plan = db.data.plans.find((p) => p.id === req.params.id && p.userId === req.user.id);
    if (!plan) fail(404, 'Plan not found');
    return plan!;
  }

  function memberGroup(req: AuthedRequest) {
    const g = db.data.groups.find((x) => x.id === req.params.id && x.memberIds.includes(req.user.id));
    if (!g) fail(404, 'Group not found');
    return g!;
  }

  function planView(plan: Plan) {
    const g = plan.groupId ? db.data.groups.find((x) => x.id === plan.groupId) : undefined;
    return {
      ...plan,
      place: catalog.get(plan.placeId),
      neighborhoodLabel: NEIGHBORHOOD_BY_ID[catalog.get(plan.placeId)?.neighborhood ?? 'downtown'].label,
      group: g ? groupProfile(db, g, placeOf) : null,
    };
  }

  // Error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  });

  return app;
}

function parseRecRequest(body: any): RecRequest {
  const b = body ?? {};
  const location = b.location === 'anywhere' || NEIGHBORHOOD_BY_ID[b.location as keyof typeof NEIGHBORHOOD_BY_ID] ? b.location : null;
  if (!location) fail(400, 'Pick a location');
  if (!TYPES.some((t) => t.id === b.type)) fail(400, 'Pick a type');
  if (!PRICE_TIERS.some((t) => t.id === b.price)) fail(400, 'Pick a price range');
  const durationMinutes = Number(b.durationMinutes);
  const hasMinutes = Number.isFinite(durationMinutes) && durationMinutes >= 15 && durationMinutes <= 720;
  if (!hasMinutes && !DURATIONS.some((d) => d.id === b.duration)) fail(400, 'Pick how long you have');
  const startAt = typeof b.startAt === 'string' && !Number.isNaN(Date.parse(b.startAt)) ? new Date(b.startAt).toISOString() : undefined;
  const timeOfDay = TIMES_OF_DAY.some((t) => t.id === b.timeOfDay) ? b.timeOfDay : undefined;
  const fb = b.feedback ?? {};
  return {
    location,
    type: b.type,
    price: b.price,
    duration: DURATIONS.some((d) => d.id === b.duration) ? b.duration : undefined,
    durationMinutes: hasMinutes ? Math.round(durationMinutes) : undefined,
    startAt,
    timeOfDay,
    groupMode: !!b.groupMode,
    groupId: typeof b.groupId === 'string' && b.groupId ? b.groupId : undefined,
    excludeIds: Array.isArray(b.excludeIds) ? b.excludeIds.map(String).slice(0, 200) : [],
    feedback: {
      moreTags: Array.isArray(fb.moreTags) ? fb.moreTags.map(String).slice(0, 10) : [],
      cheaper: !!fb.cheaper,
      closer: !!fb.closer,
      different: !!fb.different,
    },
  };
}
