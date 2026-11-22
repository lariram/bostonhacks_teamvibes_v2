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
import type { Images } from './images.js';
import { Db, newId } from './db.js';
import { generateAgenda } from './agenda.js';
import { seedDemoAccount } from './demoAccount.js';
import { buildIcs, type IcsEvent } from './ics.js';
import { recommend } from './recommender.js';
import { nearestStation, tStopBingo } from './live/stations.js';
import { intervalsAround, scheduleFor as openingHoursFor } from './hours.js';
import { formatBostonTime, bostonParts } from './live/time.js';
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
  renameOldGroups,
  systemMessage,
  verifyPassword,
} from './services.js';
import type { Place, Plan, PlaceType, Preferences, RecRequest, User } from './types.js';

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
  /** Photo lookups for curated places */
  images?: Images | null;
}

export function createApp(db: Db, opts: AppOptions = {}) {
  const random = opts.random ?? Math.random;
  const now = opts.now ?? (() => new Date());
  const catalog = new Catalog(db, opts.live ?? null, opts.images ?? null);
  const placeOf = (id: string) => catalog.get(id);
  renameOldGroups(db, placeOf);
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
  const newGuest = () => {
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
      return user;
  };
  app.post(
    '/api/auth/guest',
    h(() => {
      const user = newGuest();
      return { token: createSession(db, user.id), user: selfUser(user) };
    }),
  );

  // Guest with two weeks of history already filled in: for showing the app to judges
  app.post(
    '/api/auth/demo',
    h(() => {
      const user = newGuest();
      seedDemoAccount(db, user, placeOf, now());
      db.save();
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
        // ...and the harder mode: every T stop
        tStops: tStopBingo(
          completed
            .map((p) => placeOf(p.placeId))
            .filter((p): p is NonNullable<typeof p> => !!p && !p.live?.approxLocation),
        ),
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

      const when = scheduleFor(place!, request.startAt, request.durationMinutes);
      const plan: Plan = {
        id: newId('plan'),
        userId: req.user.id,
        placeId: place!.id,
        request: { ...request, groupId },
        groupId,
        status: 'active',
        startsAt: when.start.toISOString(),
        endsAt: when.end.toISOString(),
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

      // share now, save it for the end-of-day post, or keep it to yourself
      const mode = req.body?.shareMode ?? (req.body?.postToFeed ? 'now' : 'private');
      plan.shareLater = mode === 'later' && !plan.postId ? true : undefined;
      if (mode === 'now' && !plan.postId) {
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

  // Google Places photos, proxied so the API key never reaches the browser
  app.get('/api/photos/:placeId', async (req, res) => {
    const url = await opts.images?.googlePhotoUrl(req.params.placeId).catch(() => null);
    if (!url) return res.status(404).end();
    res.set('Cache-Control', 'private, max-age=3000').redirect(302, url);
  });

  // ───────────── calendar ─────────────
  // One plan as an .ics file (Apple Calendar / Outlook open it directly)
  app.get('/api/plans/:id/calendar.ics', auth, (req, res, next) => {
    try {
      const plan = ownPlan(req as AuthedRequest);
      res.type('text/calendar').attachment(`outbound-${plan.id}.ics`).send(buildIcs([icsFor(plan)].filter(Boolean) as IcsEvent[]));
    } catch (err) {
      next(err);
    }
  });

  // Your private subscription link for everything on My line
  app.get(
    '/api/me/calendar',
    auth,
    h((req) => {
      if (!req.user.calendarToken) {
        req.user.calendarToken = newId('cal').replace('cal_', '') + newId('x').slice(2);
        db.save();
      }
      return { path: `/api/calendar/${req.user.calendarToken}.ics` };
    }),
  );

  // The feed itself: no login (calendar apps can't log in), protected by the secret token
  app.get('/api/calendar/:file', (req, res) => {
    const token = req.params.file.replace(/\.ics$/, '');
    const user = token.length >= 16 ? db.data.users.find((u) => u.calendarToken === token) : undefined;
    if (!user) return res.status(404).json({ error: 'Calendar not found' });
    const since = now().getTime() - 60 * 24 * 60 * 60 * 1000;
    const events = db.data.plans
      .filter((p) => p.userId === user.id)
      .map(icsFor)
      .filter((e): e is IcsEvent => !!e && e.end.getTime() > since);
    res.type('text/calendar').send(buildIcs(events, `OutBound · ${user.fullName.split(' ')[0]}'s line`));
  });

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
    h((req) => {
      // "following" (default): people you follow, plus your own posts. "everyone": all posts.
      const following = new Set([...(req.user.following ?? []), req.user.id]);
      const scope = req.query.scope === 'everyone' ? 'everyone' : 'following';
      return [...db.data.posts]
        .filter((p) => scope === 'everyone' || following.has(p.userId))
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
            day: p.day
              ? {
                  date: p.day.date,
                  stops: p.day.stops
                    .map((st) => ({ at: st.at, rating: st.rating, place: catalog.get(st.placeId) }))
                    .filter((st) => st.place),
                }
              : null,
            group: group && group.status === 'active' ? { id: group.id, name: group.name, size: group.memberIds.length } : null,
            likes: p.likes.length,
            likedByMe: p.likes.includes(req.user.id),
            wantedByMe: req.user.wantIds.includes(p.placeId),
            mine: p.userId === req.user.id,
            following: (req.user.following ?? []).includes(p.userId),
          };
        });
    }),
  );

  // ───────────── people & following ─────────────
  app.get(
    '/api/users/:id',
    auth,
    h((req) => {
      const u = db.user(req.params.id);
      if (!u) fail(404, 'Person not found');
      const posts = db.data.posts
        .filter((p) => p.userId === u!.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 20)
        .map((p) => ({ id: p.id, rating: p.rating, caption: p.caption, createdAt: p.createdAt, place: catalog.get(p.placeId), stops: p.day?.stops.length ?? 0 }))
        .filter((p) => p.place);
      const sharedCrews = db.data.groups
        .filter((g) => g.status !== 'ended' && g.memberIds.includes(u!.id) && g.memberIds.includes(req.user.id))
        .map((g) => ({ id: g.id, name: g.name }));
      return {
        user: publicUser(u!),
        me: u!.id === req.user.id,
        following: (req.user.following ?? []).includes(u!.id),
        followers: db.data.users.filter((x) => x.following?.includes(u!.id)).length,
        followingCount: u!.following?.length ?? 0,
        posts,
        sharedCrews,
      };
    }),
  );

  app.post(
    '/api/users/:id/follow',
    auth,
    h((req) => {
      const target = db.user(req.params.id);
      if (!target || target.id === req.user.id) fail(400, "You can't follow that account");
      const list = (req.user.following ??= []);
      const i = list.indexOf(target!.id);
      if (i >= 0) list.splice(i, 1);
      else list.push(target!.id);
      db.save();
      return { following: i < 0, followingIds: list };
    }),
  );

  // Who to follow: people from your groups first, then people posting lately
  app.get(
    '/api/people/suggested',
    auth,
    h((req) => {
      const skip = new Set([req.user.id, ...(req.user.following ?? [])]);
      const crewmates = db.data.groups
        .filter((g) => g.memberIds.includes(req.user.id))
        .flatMap((g) => g.memberIds.map((id) => ({ id, why: `In ${g.name}` })));
      const posters = [...db.data.posts]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((p) => ({ id: p.userId, why: 'Posting lately' }));
      const seen = new Set<string>();
      return [...crewmates, ...posters]
        .filter((x) => !skip.has(x.id) && !seen.has(x.id) && seen.add(x.id))
        .slice(0, 6)
        .map((x) => ({ user: publicUser(db.user(x.id)!), why: x.why }))
        .filter((x) => x.user);
    }),
  );

  app.get(
    '/api/following',
    auth,
    h((req) => (req.user.following ?? []).map((id) => db.user(id)).filter((u): u is User => !!u).map(publicUser)),
  );

  // ───────────── saved from the feed ─────────────
  app.get(
    '/api/saved',
    auth,
    h((req) =>
      req.user.wantIds
        .map((id) => catalog.get(id))
        .filter((p): p is Place => !!p)
        // a saved one-off event that's already over isn't worth showing
        .filter((p) => !p.live || p.live.openHours || Date.parse(p.live.endsAt ?? p.live.startsAt) > now().getTime())
        .map((p) => ({
          place: p,
          planned: db.data.plans.some((pl) => pl.userId === req.user.id && pl.placeId === p.id && pl.status === 'active'),
        })),
    ),
  );

  app.post(
    '/api/saved/:placeId',
    auth,
    h((req) => {
      const p = catalog.get(req.params.placeId);
      if (!p) fail(404, 'Unknown place');
      const i = req.user.wantIds.indexOf(p!.id);
      if (i >= 0) req.user.wantIds.splice(i, 1);
      else {
        req.user.wantIds.push(p!.id);
        catalog.remember(p!);
      }
      db.save();
      return { saved: i < 0 };
    }),
  );

  // ───────────── surprise agenda ─────────────
  app.post(
    '/api/agenda',
    auth,
    h((req) => {
      const b = req.body ?? {};
      const start = NEIGHBORHOODS.find((n) => n.id === b.start)?.id;
      const price = PRICE_TIERS.find((t) => t.id === b.price)?.id ?? req.user.lastPrice ?? '20to40';
      const date = typeof b.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : undefined;
      const { days } = generateAgenda(
        { span: b.span === 'week' ? 'week' : 'day', pace: b.pace === 'stay' ? 'stay' : 'wander', start, price, date },
        { user: req.user, places: catalog.candidates(now()), random, now: now() },
      );
      return {
        days: days.map((d) => ({
          ...d,
          route: d.route.map((id) => ({ id, label: NEIGHBORHOOD_BY_ID[id].label })),
        })),
      };
    }),
  );

  // ───────────── share your day ─────────────
  /** Your finished stops on one Boston day, in order */
  const dayStops = (userId: string, date: string) =>
    db.data.plans
      .filter((p) => p.userId === userId && p.status === 'completed')
      .map((p) => ({ p, at: p.startsAt ?? p.completedAt ?? p.createdAt }))
      .filter(({ at }) => bostonParts(new Date(at)).date === date)
      .sort((a, b) => a.at.localeCompare(b.at))
      .map(({ p, at }) => ({ plan: p, at, place: placeOf(p.placeId) }))
      .filter((x) => x.place);
  const dayDate = (q: unknown) => (typeof q === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : bostonParts(now()).date);
  const dayPost = (userId: string, date: string) => db.data.posts.find((p) => p.userId === userId && p.day?.date === date);

  app.get(
    '/api/day',
    auth,
    h((req) => {
      const date = dayDate(req.query.date);
      const post = dayPost(req.user.id, date);
      return {
        date,
        stops: dayStops(req.user.id, date).map(({ plan, at, place }) => ({
          planId: plan.id,
          at,
          rating: plan.rating ?? 0,
          place,
          group: (({ id, name }) => (id ? { id, name } : null))(db.data.groups.find((g) => g.id === plan.groupId) ?? { id: '', name: '' }),
        })),
        sharedPostId: post?.id ?? null,
        savedForLater: dayStops(req.user.id, date).filter(({ plan }) => plan.shareLater).length,
        caption: post?.caption ?? '',
      };
    }),
  );

  app.post(
    '/api/day/share',
    auth,
    h((req) => {
      const date = dayDate(req.body?.date);
      const stops = dayStops(req.user.id, date);
      if (stops.length < 2) fail(400, 'Finish at least two stops to share your day');
      const caption = typeof req.body?.caption === 'string' ? req.body.caption.trim().slice(0, 280) || undefined : undefined;
      const groupIds = [...new Set(stops.map((s) => s.plan.groupId).filter(Boolean))];
      const day = {
        date,
        stops: stops.map(({ plan, at }) => ({ planId: plan.id, placeId: plan.placeId, rating: plan.rating ?? 0, at })),
      };
      const rated = day.stops.filter((s) => s.rating);
      const rating = rated.length ? Math.round(rated.reduce((a, s) => a + s.rating, 0) / rated.length) : 0;
      for (const { plan } of stops) plan.shareLater = undefined;
      let post = dayPost(req.user.id, date);
      if (post) Object.assign(post, { day, caption, placeId: day.stops[0].placeId, rating, groupId: groupIds.length === 1 ? groupIds[0] : undefined });
      else {
        post = {
          id: newId('post'),
          userId: req.user.id,
          placeId: day.stops[0].placeId,
          rating,
          caption,
          groupId: groupIds.length === 1 ? groupIds[0] : undefined,
          likes: [],
          wants: [],
          day,
          createdAt: now().toISOString(),
        };
        db.data.posts.push(post);
      }
      db.save();
      return { id: post.id };
    }),
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
          catalog.remember(place);
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
      const name = typeof req.body?.name === 'string' ? req.body.name.replace(/\s+/g, ' ').trim().slice(0, 40) : '';
      if (!name) throw new HttpError(400, 'Give the group a name');
      if (name !== g.name) {
        g.name = name;
        systemMessage(db, g.id, `${req.user.fullName.split(' ')[0]} renamed the group to "${name}"`);
      }
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
  /** When a plan happens: a live event's own time, otherwise the start you picked */
  function scheduleFor(p: Place, startAt?: string, durationMinutes?: number): { start: Date; end: Date } {
    if (p.live && !p.live.openHours && !p.live.timeTBA) {
      const start = new Date(p.live.startsAt);
      return { start, end: p.live.endsAt ? new Date(p.live.endsAt) : new Date(start.getTime() + p.minutes * 60_000) };
    }
    const start = startAt && Date.parse(startAt) > now().getTime() - 60 * 60_000 ? new Date(startAt) : now();
    const minutes = Math.min(p.minutes, durationMinutes ?? p.minutes);
    return { start, end: new Date(start.getTime() + minutes * 60_000) };
  }

  function icsFor(plan: Plan): IcsEvent | null {
    const p = catalog.get(plan.placeId);
    if (!p) return null;
    const start = new Date(plan.startsAt ?? plan.createdAt);
    const end = plan.endsAt ? new Date(plan.endsAt) : new Date(start.getTime() + p.minutes * 60_000);
    const g = plan.groupId ? db.data.groups.find((x) => x.id === plan.groupId) : undefined;
    return {
      uid: `${plan.id}@outbound.boston`,
      start,
      end,
      summary: `${p.name}${g ? ` with ${g.name}` : ''}`,
      location: p.address,
      description: [p.blurb, `Nearest T: ${p.tStop}`, p.live ? `Listing: ${p.live.url}` : '', 'Planned with OutBound']
        .filter(Boolean)
        .join('\n'),
      url: p.live?.url,
    };
  }

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
      // Opening hours on the day of the plan ("11 AM – 11:30 PM"), flagged if approximate
      hours: (() => {
        const p = catalog.get(plan.placeId);
        if (!p || p.live) return null;
        const h = p.openingHours ?? openingHoursFor(p.id);
        if (!h) return null;
        const day = new Date(plan.startsAt ?? plan.createdAt);
        const today = intervalsAround(h.schedule, day).filter(([o]) => bostonParts(o).date === bostonParts(day).date);
        return {
          text: today.length ? today.map(([o, c]) => `${formatBostonTime(o)} – ${formatBostonTime(c)}`).join(', ') : 'Closed',
          approx: h.approx,
        };
      })(),
      station: (() => {
        const p = catalog.get(plan.placeId);
        return p && !p.live?.approxLocation ? nearestStation(p.lat, p.lng) : null;
      })(),
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
    widen: !!b.widen,
    from:
      b.from && Number.isFinite(Number(b.from.lat)) && Number.isFinite(Number(b.from.lng))
        ? { lat: Number(b.from.lat), lng: Number(b.from.lng) }
        : undefined,
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
