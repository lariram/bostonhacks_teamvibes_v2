# common.

**Two picks. One crew. Your next stop.**

BostonHacks 2026 · Team Vibes · Track: **Boundless Boston**

Boston is America's college city: 35+ campuses, a quarter-million students, and most of them never leave their bubble. BU stays on Comm Ave, Harvard stays in the Square, and the people who've lived here their whole lives rarely meet either. On top of that, "what should we do?" is its own kind of exhausting.

**common** kills the decision paralysis and the bubble at the same time:

1. **Four quick stops:** where, what (event / activity / food), budget, and when. You get **two** options, A or B. That's the whole decision. Not feeling either? Tell it one thing ("Japanese", "cheaper") and get two more.
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

```bash
npm test            # 21 backend tests: algorithm + end-to-end API flow
npm run typecheck   # both apps
npm run build       # production build of the web app
npm start           # one server on :3001 serving the API + built web app
```

## 2-minute demo script

1. **Try it as a guest** → pick a few interests (Chinese, Dessert, Live music…) → Continue.
2. **Where to?** Chinatown · Food · $10–$20 · Evening · 1–2 hrs · **Find me a crew**. Watch the route line fill in with the Orange Line color as you answer. → *Show me two*
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

## How the recommendation algorithm works

`backend/src/recommender.ts` is pure functions, fully unit-tested.

**Scoring:** `0.40·interest + 0.25·location + 0.15·price fit + 0.10·duration fit`, plus small boosts for community ratings, in-season items, and anything you asked for in feedback, plus a little jitter so "two more" feels alive.

- **Interest** comes from your onboarding tags plus **learned weights**: 5★ ratings push a place's tags up, 1★ pushes them down; liking or saving feed posts nudges them too.
- **Location**: same neighborhood > adjacent (a quick T hop) > elsewhere.
- Out-of-season things (Swan Boats in November) are never suggested.

**Constraint relaxation:** if the exact filters can't produce two options, it loosens one step at a time and **labels what it stretched**: exact → time-of-day / slightly longer → anywhere in the city → one tier over budget → repeats.

**Diversity:** B is the best option that *differs* from A (neighborhood or vibe) when it's close in score, so it's a real choice.

**Crews:** every rider's interest is scored separately and combined as `0.6·(least-happy rider) + 0.4·(average)`, so nobody gets dragged somewhere they'd hate. The budget is capped at the lowest rider's comfort level, and anywhere the crew has already been is skipped.

**Crew matching** (`services.ts → matchCrew`): if someone else is forming a crew at the same spot (within 6 hours), you join theirs. That's how two real users get matched. Otherwise a new crew starts and invites the most compatible locals (shared interests, similar age, would like this place).

## Project structure

```
backend/                 Node + Express + TypeScript
  src/data/places.ts     106 curated Boston spots (address, lat/lng, T stop, local tip)
  src/data/meta.ts       neighborhoods + adjacency, price tiers, durations, tags
  src/data/seedUsers.ts  simulated locals + starter feed posts (for demos)
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
| GET | `/api/history`, `/api/feed` | |
| POST | `/api/feed/:id/react` | `like` / `want` (both shape recommendations) |
| GET/POST | `/api/groups/:id`, `/keep`, `/messages`, `/join-current`, `/leave` | crew profile + chat |

## Notes and honest caveats

- **Places are real; details are approximate.** Prices, hours and seasons are best-effort for a demo. Verify before relying on them. Events are modeled as venues and recurring happenings so the catalog doesn't go stale.
- **The crew members you meet in a solo demo are simulated locals** (flagged `isDemo`), so one person can demo crews. Two real accounts that take the same spot with "Find me a crew" on **will** be matched together.
- **Guest mode is for demos:** it skips sign-up (and the 18+ check), and logging out ends the guest account. Real accounts must be 18+. Every catalog spot is a public venue.
- Auth is simple (scrypt-hashed passwords, bearer tokens): fine for a hackathon, not production-hardened.
- Maps use OpenStreetMap embeds (grayscale, with our own station pin) and Google Maps links. No API keys needed.

## Where it could go next

- Live events from Eventbrite / Ticketmaster / venue calendars on the same `Place` shape
- Real-time T arrivals from the MBTA V3 API on the station sign ("Next Orange Line: 4 min")
- Skill levels for activities (beginner → expert) to match people learning the same thing
- Identity verification at onboarding; real-time chat over WebSockets
- Native app (the UI is already phone-first)
