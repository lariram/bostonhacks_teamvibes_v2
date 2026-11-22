# common.

**Two picks. One crew. Your next stop.**

BostonHacks 2026 · Team Vibes · Track: **Boundless Boston**

Boston is America's college city: 35+ campuses, a quarter-million students, and most of them never leave their bubble. BU stays on Comm Ave, Harvard stays in the Square, and the people who've lived here their whole lives rarely meet either. On top of that, "what should we do?" is its own kind of exhausting.

**common** kills the decision paralysis and the bubble at the same time:

1. **Tell it who you are** (student, local, visiting, new in town), then **four quick stops:** where, what (event / activity / food), budget, and when (a start time in 30-minute steps and how long you have). You get **two** options, A or B. That's the whole decision. Not feeling either? Tell it one thing ("Japanese", "cheaper") and get two more. Picks include **real events happening today**, pulled live from public Boston calendars (universities, Downtown Boston, Massachusetts 250, SoWa), plus Ticketmaster and Google's event listings if you add keys.
2. **"Find me a crew."** When you take a pick, you're matched with other Bostonians headed to the same spot.
3. **Stay on with the crew.** Clicked with them? Keep the group for the rest of the day. The crew gets its own **group profile**, and picks only include things that work for *every* rider's tastes and budget.

Rate each stop (5 stars + private notes), post it to the feed, and watch **Your Boston**, a T-style map of all 12 neighborhoods, light up as you explore.

> *Named for Boston Common, where America's first subway opened in 1897.* Working name: change `APP_NAME` in `frontend/src/config.ts`.

---

## Quick start

Requires **Node 20.19+ or 22.12+**.

```bash
git clone https://github.com/lariram/bostonhacks_teamvibes_v2
```

```bash
cd bostonhacks_teamvibes_v2
```

```bash
npm install
```

```bash
npm run dev
```

Open **http://localhost:5173** and tap **Try it as a guest**. No sign-up needed. (Best in a phone-sized window: dev tools → device toolbar.)

- API runs on `:3001`, web on `:5173` (Vite proxies `/api`). To use it on your phone, open the `Network:` URL that `npm run dev` prints (same Wi-Fi).
- Data is stored in `backend/data/db.json` (gitignored). Delete it to reset; demo locals and starter feed posts re-seed on start.
- **Live events work out of the box** from seven public calendars (MIT, Northeastern, BU, Boston College, Downtown Boston, Massachusetts 250, SoWa). For concerts, sports, comedy and Google's listings, add free API keys: copy `backend/.env.example` to `backend/.env` and fill it in (see [Live events](#live-events-whats-on-today)).

```bash
npm test            # 46 backend tests: algorithm, live-event parsing, end-to-end API flow
npm run typecheck   # both apps
npm run build       # production build of the web app
npm start           # one server on :3001 serving the API + built web app
```

## 2-minute demo script

1. **Try it as a guest** → **Student** → pick a few interests (Chinese, Dessert, Live music…) → Continue.
2. **Where to?** Chinatown · Food · $10–$20 · a start time · 1.5 hrs · **Find me a crew**. Watch the route line fill in with the Orange Line color as you answer. → *Show me two*
3. **A or B.** Point out the "why" line ("You're into Chinese · Right in Chinatown"): the algorithm explains itself.
4. **Neither. Show me two more** → tap "Japanese" → it finds hot pot and flags it as *a little over budget* instead of ignoring you.
5. **Take A** → station sign, map, address, nearest T, local tip, and **your crew** (3 Bostonians from different schools) → **Crew chat**.
6. **I'm done, rate it** → stars, private notes, post to feed.
7. **Next stop?** → **Stay with the crew** → the budget is now *"Crew max $10–$20"*, and picks say things like *"You, Maya & Hana love live music"*.
8. **Feed** (save a spot → it boosts your picks) → **My line** (your history as a transit line) → **Profile** (the *Your Boston* map lights up).

## Design

The whole visual system is borrowed from the T: black-and-white Helvetica signage, with **MBTA line colors as the only accents, and every color means something.**

| Color | Means |
| --- | --- |
| Red Line `#DA291C` | Events |
| Green Line `#00843D` | Activities |
| Orange Line `#ED8B00` | Food |
| Bus yellow `#FFC72C` | Local tips, heads-ups, star ratings |
| Each crew | Gets its own line color (stable per crew) |
| You | Your history is your own line, in your color |

Signature pieces (all in `frontend/src/components/Transit.tsx`):
- **Brand mark:** four T lines converging on one station. *common* = where Boston's lines meet.
- **The route:** the planner is a line diagram. Each question is a stop, and the line fills in as you answer.
- **The fork:** results open with one track splitting into branches **A** and **B**, like the Green Line branches.
- **Station sign:** every place gets a black platform-style sign with its nearest T line bullets.
- **My line / Your day together:** history and a crew's day are drawn as stations on a line, with the current stop pulsing.
- **Your Boston:** a schematic T-style map of the 12 neighborhoods that fills in as you explore (the mentor's "Boston bingo" idea).
- **Neighborhood chips** carry real line bullets (Cambridge = Red, Seaport = Silver, Downtown = all four).

The minimalism is on purpose: the app exists to remove decisions, so every screen asks for one thing.

*common is a student project and is not affiliated with the MBTA. The line colors are a nod to the T.*

## Live events: what's on today

On top of the 106 curated spots, common pulls **today's real events** (in Boston time) and mixes them into the picks. A real show tonight gets a boost and says so: *"Starts in 40 min"*, *"Only on today"*.

| Source | What it adds | Setup |
| --- | --- | --- |
| **University calendars:** MIT, Northeastern, BU, Boston College (Localist public API) | Campus concerts, exhibits, readings, games, workshops: lots of them free | None. On by default |
| **Community calendars:** Downtown Boston, Massachusetts 250, SoWa (WordPress events API) | Shows downtown and in the Theater District, history exhibits at Boston museums, SoWa markets in season | None. On by default |
| **Ticketmaster Discovery API** | Concerts, sports, comedy and theater at Boston venues | Free key at [developer.ticketmaster.com](https://developer.ticketmaster.com) → `TICKETMASTER_API_KEY` |
| **Google Events** via [SerpApi](https://serpapi.com) | Whatever Google shows for "Events in Boston" today | Free-tier key → `SERPAPI_API_KEY` (refreshes every 12 h to stay in the free tier) |

Google has no official events API, so Google's listings come through SerpApi. Put keys in `backend/.env` (gitignored); never commit them.

**How it stays trustworthy** (`backend/src/live/`):
- **Today only, in Boston time,** whatever timezone the server is in. Anything that started more than 30 minutes ago drops out (drop-in exhibits stay while there's time left to see them), and listings without a start time are never suggested.
- **Only things in our 12 neighborhoods.** Each listing is placed by its real coordinates, then ZIP code, then address text. Away games ("Location: Norton, MA") and anything farther out (Gillette) are skipped.
- **Only fun things.** Seminars, info sessions, career events, rehearsals, away games, Zoom/virtual events and thesis defenses are filtered out of the university feeds.
- **Real details:** time range, cost, the nearest T stop computed from the venue (*"Kendall/MIT · 1 min walk"*), and links to the event page and tickets/registration. Campus events carry a note to check they're open to the public.
- **De-duplicated:** the same show listed by two sources appears once (Ticketmaster wins), and a curated entry is hidden when the real listing is on today (by venue or by name, so the live Nutcracker replaces our generic one). Listings without coordinates borrow the exact location, T stop and price of a venue or show we already know.
- **Resilient:** each source is cached and refreshed on its own schedule in the background. A request never waits on the network, and one source failing never affects the others. `GET /api/live` shows each source's status.
- **Picked events are saved,** so your history, the feed and crews keep working after an event leaves the live cache.

**What was verified:** all seven keyless calendars were tested against their real APIs (28 upcoming events on a sample weekday). The Ticketmaster and SerpApi adapters follow their documented response formats and are covered by fixture tests, but weren't run against the live services (no keys during development). Try them with your own keys and check `GET /api/live`.

If your network uses an HTTPS proxy, start the server with `NODE_USE_ENV_PROXY=1` so Node's `fetch` uses it.

## How the recommendation algorithm works

`backend/src/recommender.ts` is pure functions, fully unit-tested.

**Scoring:** `0.40·interest + 0.25·location + 0.15·price fit + 0.10·duration fit`, plus small boosts for community ratings, in-season items, and anything you asked for in feedback, plus a little jitter so "two more" feels alive.

- **Interest** comes from your onboarding tags plus **learned weights**: 5★ ratings push a place's tags up, 1★ pushes them down; liking or saving feed posts nudges them too.
- **Location**: same neighborhood > adjacent (a quick T hop) > elsewhere.
- Out-of-season things (Swan Boats in November) are never suggested.

**Location comes first.** Picks are always in your neighborhood. Only if it can't find two there does it use a neighborhood right next door, and it never goes farther. If nothing fits, you get one pick, or an honest "nothing fits" with a nudge to change the time, rather than something across town.

**Events are real events.** "Event" only ever means a dated listing from a live source that starts within your window (or up to 30 minutes before it), never a venue that might have something on. Food and activities come from the curated places (plus live exhibits and workshops that are open during your window).

**Who you are matters a little.** Students get a nudge toward campus events and free/cheap picks; locals away from tourist traps and toward locally owned spots; visitors and newcomers toward the Boston classics.

**Constraint relaxation:** if the exact filters can't produce two options, it loosens one step at a time and **labels what it stretched**: exact → next-door neighborhood → (places only) outside their usual hours or a bit longer than your time → one tier over budget → repeats.

**Diversity:** B is the best option that *differs* from A (neighborhood or vibe) when it's close in score, so it's a real choice.

**Crews:** every rider's interest is scored separately and combined as `0.6·(least-happy rider) + 0.4·(average)`, so nobody gets dragged somewhere they'd hate. The budget is capped at the lowest rider's comfort level, and anywhere the crew has already been is skipped.

**Crew matching** (`services.ts → matchCrew`): if someone else is forming a crew at the same spot (within 6 hours), you join theirs. That's how two real users get matched. Otherwise a new crew starts and invites the most compatible locals (shared interests, similar age, would like this place).

## Project structure

```
backend/                 Node + Express + TypeScript
  src/data/places.ts     106 curated Boston spots (address, lat/lng, T stop, local tip)
  src/data/meta.ts       neighborhoods + adjacency, price tiers, durations, tags
  src/data/seedUsers.ts  simulated locals + starter feed posts (for demos)
  src/live/              today's real events: sources, Boston time, location + T stop inference
  src/catalog.ts         curated places + live events + saved picks, in one lookup
  src/recommender.ts     the algorithm
  src/services.ts        auth, taste profiles, crew matching, group profiles
  src/app.ts             REST API
  test/                  vitest: algorithm + full end-to-end API flow
frontend/                React + Vite + TypeScript (mobile-first)
  src/config.ts          brand name + MBTA color system
  src/components/        Transit.tsx (map, route, fork, signs), chips, cards, nav
  src/pages/             Start, Login, Signup, Onboarding, Discover, Results,
                         PlanDetails, Rate, Next, Feed, History, Profile, GroupPage
  src/styles.css         the design system
```

## API overview

| Method | Path | What |
| --- | --- | --- |
| GET | `/api/meta` | neighborhoods, types, price tiers, durations, tags |
| POST | `/api/auth/guest` | one-tap demo account |
| POST | `/api/auth/signup`, `/api/auth/login` | returns a bearer token |
| GET/PUT | `/api/me`, `/api/me/preferences` | profile, stats, neighborhoods visited |
| POST | `/api/recommendations` | `{location,type,price,duration,timeOfDay?,groupMode?,groupId?,excludeIds?,feedback?}` → 2 picks |
| POST | `/api/plans` | take a pick (forms a crew if `groupMode`) |
| POST | `/api/plans/:id/complete` | rating, private notes, optional feed post |
| GET | `/api/live` | today's live-event count and each source's status |
| GET | `/api/history`, `/api/feed` | |
| POST | `/api/feed/:id/react` | `like` / `want` (both shape recommendations) |
| GET/POST | `/api/groups/:id`, `/keep`, `/messages`, `/join-current`, `/leave` | crew profile + chat |

## Notes and honest caveats

- **Curated places are real; details are approximate.** Prices, hours and seasons in the catalog are best-effort for a demo. Live events come straight from their sources, but listings change, so check the event page before you go.
- **The crew members you meet in a solo demo are simulated locals** (flagged `isDemo`), so one person can demo crews. Two real accounts that take the same spot with "Find me a crew" on **will** be matched together.
- **Guest mode is for demos:** it skips sign-up (and the 18+ check), and logging out ends the guest account. Real accounts must be 18+. Every catalog spot is a public venue.
- Auth is simple (scrypt-hashed passwords, bearer tokens): fine for a hackathon, not production-hardened.
- Maps use OpenStreetMap embeds (grayscale, with our own station pin) and Google Maps links. No API keys needed.

## Where it could go next

- More live sources: any Localist calendar (add it to `KNOWN_LOCALIST` in `backend/src/live/sources/localist.ts`) or WordPress "The Events Calendar" site (`KNOWN_WP_EVENTS` in `wpEvents.ts`). Harvard and Tufts have their calendar APIs turned off, and the Greenway, BPL and city calendars don't publish a feed we can use
- Real-time T arrivals from the MBTA V3 API on the station sign ("Next Orange Line: 4 min")
- Skill levels for activities (beginner → expert) to match people learning the same thing
- Identity verification at onboarding; real-time chat over WebSockets
- Native app (the UI is already phone-first)
