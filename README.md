# OutBound

**Branch out. Chime in. Explore Boston together.**

BostonHacks 2026 · Team Vibes · Track: **Boundless Boston**

Boston is America's college city: 35+ campuses, a quarter-million students, and most of them never leave their bubble. BU stays on Comm Ave, Harvard stays in the Square, and the people who've lived here their whole lives rarely meet either. On top of that, "what should we do?" is its own kind of exhausting.

**OutBound** kills the decision paralysis and the bubble at the same time:

1. **Tell it who you are** (student, local, visiting, new in town), then **four quick stops:** where, what (event / activity / food), budget, and when (today or any day in the next two weeks, a start time in 30-minute steps, and how long you have). You get **two** options, A or B. That's the whole decision. Not feeling either? Tell it one thing ("Japanese", "cheaper") and get two more. Picks include **real events happening today**, pulled live from public Boston calendars (universities, Downtown Boston, Massachusetts 250, SoWa), plus Ticketmaster and Google's event listings if you add keys.
2. **"Find me a group."** When you take a pick, you're matched with other Bostonians headed to the same spot.
3. **Stay on with the group.** Clicked with them? Keep the group for the rest of the day. The group gets its own **group profile**, and picks only include things that work for *every* rider's tastes and budget.

Rate each stop (5 stars + private notes), post it to the feed, and watch **Your Boston**, a T-style map of all 12 neighborhoods, light up as you explore.

> *On the T, outbound means leaving downtown for somewhere new.* The name lives in `APP_NAME` in `frontend/src/config.ts`.

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
npm test            # 64 backend tests: algorithm, live-event parsing, end-to-end API flow
npm run typecheck   # both apps
npm run build       # production build of the web app
npm start           # one server on :3001 serving the API + built web app
```

## 2-minute demo script

1. **Try it as a guest** → **Student** → pick a few interests (Chinese, Dessert, Live music…) → Continue.
2. **Where to?** Chinatown · Food · $10–$20 · a start time · 1.5 hrs · **Find me a group**. Watch the route line fill in with the Orange Line color as you answer. → *Show me two*
3. **A or B.** Point out the "why" line ("You're into Chinese · Right in Chinatown"): the algorithm explains itself.
4. **Neither. Show me two more** → tap "Japanese" → it finds hot pot and flags it as *a little over budget* instead of ignoring you.
5. **Take A** → station sign, map, address, nearest T, local tip, and **your group** (3 Bostonians from different schools) → **Group chat**.
6. **I'm done, rate it** → stars, private notes, post to feed.
7. **Next stop?** → **Stay with the group** → the budget is now *"Group max $10–$20"*, and picks say things like *"You, Maya & Hana love live music"*.
8. **Feed** (save a spot → it boosts your picks) → **My line** (your history as a transit line) → **Profile** (the *Your Boston* map lights up).

## Design

The whole visual system is borrowed from the T: black-and-white Helvetica signage, with **MBTA line colors as the only accents, and every color means something.**

| Color | Means |
| --- | --- |
| Red Line `#DA291C` | Events |
| Green Line `#00843D` | Activities |
| Orange Line `#ED8B00` | Food |
| Bus yellow `#FFC72C` | Local tips, heads-ups, star ratings |
| Each group | Gets its own line color (stable per group) |
| You | Your history is your own line, in your color |

Signature pieces (all in `frontend/src/components/Transit.tsx`):
- **Brand mark:** one line comes in from the left to a station, splits in two, and each branch splits again into the four T colors (choose your own adventure). *OutBound*: every T line heads out from downtown toward somewhere new.
- **The route:** the planner is a line diagram. Each question is a stop, and the line fills in as you answer.
- **The fork:** results open with one track splitting into branches **A** and **B**, like the Green Line branches.
- **Station sign:** every place gets a black platform-style sign with its nearest T line bullets.
- **My line / Your day together:** history and a group's day are drawn as stations on a line, with the current stop pulsing.
- **Your Boston:** "Boston bingo" (the mentor's idea), with two maps to switch between:
  - **Neighborhoods:** a schematic T-style map of the 12 neighborhoods that fills in as you explore.
  - **T stops:** all 141 subway, trolley, Mattapan and Silver Line stops on a schematic map styled like the platform diagram (straight lines at 45°, not to scale). Drag to move; pinch, scroll, double-tap or use the +/− buttons to zoom. Names appear as you zoom in, and labels that would overlap are skipped. Every place you complete checks off its nearest stop (within about 1 km). Per-line progress is shown below the map (e.g. Green 4/69); tap a line to zoom to it, or tap a stop for its name. The layout lives in `frontend/src/components/tmapLayout.ts`.
- **Neighborhood chips** carry real line bullets (Cambridge = Red, Seaport = Silver, Downtown = all four).

The minimalism is on purpose: the app exists to remove decisions, so every screen asks for one thing.

*OutBound is a student project and is not affiliated with the MBTA. The line colors are a nod to the T.*

## Following

Follow people from your groups, from the feed, or from their profile. The feed opens on **Following** (them plus you); **Everyone** is one tap away. If you don't follow anyone yet, it suggests people, groupmates first.

**Share your day.** Once you have finished two or more stops in a day, the "Next stop?" screen and My line offer **Share your day**: every stop in order (times, neighborhoods, your stars, never your private reviews) as one post drawn as a line, with a caption. Sharing again updates the same post. API: `GET /api/day`, `POST /api/day/share`.

**Share later.** When you rate a stop you choose **Post now**, **Add to my day post** (saved for one end-of-day post of the whole day), or **Keep private**. "Next stop?" shows how many stops are saved and offers **Post your day**.

**Demo account.** On the start screen, **See a demo account** logs in as "Alex Rivera": 17 stops over two weeks, 8 of 12 neighborhoods on the bingo map, a group ("Museum Saturdays"), feed posts including a shared day, people followed, saved spots, two stops today saved for the day post, and one coming up. It skips onboarding. Code: `backend/src/demoAccount.ts`, `POST /api/auth/demo`.

**Plan it for me.** "Can't decide at all?" on Discover builds a random solo **day** (about five stops, 10:30 AM to evening) or **week of evenings** (two stops on weeknights, three on weekends). Each stop is a short walk from the last (about 1.3 km, widening only if nothing fits), open when you arrive, within budget, never repeated, and weighted toward your tastes. **Stay put** keeps it in one neighborhood; **Wander** may drift into an adjacent one, and a week picks up each day where the last one ended. Shuffle, or add every stop to My line. Code: `backend/src/agenda.ts`, `POST /api/agenda`.

## Photos

Every recommendation can show a real photo (never AI-generated), always with a credit:
1. **Live events** use the photo from their own listing (university calendars, Downtown Boston, Ticketmaster, Google Events).
2. **Curated places** use **Google Places photos** if `GOOGLE_PLACES_API_KEY` is set (best coverage, restaurants included; served through `/api/photos/:id` so the key never reaches the browser, with the photographer credited, as Google requires).
3. Otherwise **Wikipedia / Wikimedia Commons**: freely licensed photos only, for landmarks and venues with an article (about a third of the catalog).
4. No photo? Cards just don't show one; thumbnails fall back to a small type-colored tile.

We don't pull from Google Images search: those photos belong to their owners, and scraping Google's results breaks its terms.

## Maps

Each place gets a quiet light-gray map (OpenStreetMap tiles, grayscale) with the place as a pin in its type color, the nearest T station as a square in its line color, and a dotted walking path between them. If tiles can't load, the pin, station and path still draw on a plain grid.

## Live events: what's on today

On top of the 106 curated spots, OutBound pulls **real events for the next two weeks** (in Boston time) and mixes them into the picks, so you can plan tonight or next Thursday. A real show tonight gets a boost and says so: *"Starts in 40 min"*, *"Only on today"*.

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
- **Picked events are saved,** so your history, the feed and groups keep working after an event leaves the live cache.

**What was verified:** all seven keyless calendars were tested against their real APIs (28 upcoming events on a sample weekday). The Ticketmaster and SerpApi adapters follow their documented response formats and are covered by fixture tests, but weren't run against the live services (no keys during development). Try them with your own keys and check `GET /api/live`.

If your network uses an HTTPS proxy, start the server with `NODE_USE_ENV_PROXY=1` so Node's `fetch` uses it.

## My line + calendars

**My line** is one continuous line: your recent stops, a pulsing **Now** marker, then the line runs on (dashed) into the future, day by day, through everything you have coming up, including dated events you saved from the feed. Spots you saved without a date sit in **Saved for any time**. Switch to **Calendar** for a month view: filled dots are plans, hollow dots are saved events. Every plan has a real time: a live event's own start, or the time you picked.

- **In-app calendar first:** *Add to my calendar for later* (on any pick, or any saved spot) puts it on My line without linking anything external.
- **Add one plan elsewhere:** on a plan's page, *Google Calendar* opens a pre-filled event; *Apple / Outlook (.ics)* downloads a calendar file.
- **Sync everything:** *Get my calendar link* on My line gives you a private feed. *Subscribe in Apple Calendar* adds it, and new plans show up automatically. For Google Calendar, paste it into *Settings → Add calendar → From URL*. Calendar apps can only reach the feed while the app runs somewhere they can see: your own computer for Apple Calendar, a public server for Google.

## How the recommendation algorithm works

`backend/src/recommender.ts` is pure functions, fully unit-tested.

**Scoring:** `0.40·interest + 0.25·location + 0.15·price fit + 0.10·duration fit`, plus small boosts for community ratings, in-season items, and anything you asked for in feedback, plus a little jitter so "two more" feels alive.

- **Interest** comes from your onboarding tags plus **learned weights**: 5★ ratings push a place's tags up, 1★ pushes them down; liking or saving feed posts nudges them too.
- **Location**: same neighborhood > adjacent (a quick T hop) > elsewhere.
- Out-of-season things (Swan Boats in November) are never suggested.

**Location comes first.** Picks are always in your neighborhood. Only if it can't find two there does it use a neighborhood right next door, and it never goes farther. If nothing fits, you get one pick, or an honest "nothing fits" with a nudge to change the time, rather than something across town. **Optional wider search:** turn on *"Nothing here? Look anywhere on the T"* and, only when there isn't enough nearby, it also looks anywhere reachable by subway, Green Line or Silver Line (no Commuter Rail): all 12 neighborhoods plus T towns like Malden, Quincy, Brookline and Revere. Those picks say where they are and how far.

**Open when you get there.** Every pick is judged at the moment you'd *arrive*, not when you leave. The trip is estimated from where you are (if you allow location; otherwise from the area you picked): walking for short hops, otherwise walk to the nearest station + wait + ride + any line change + walk. A place has to be open on arrival with enough time left for a real visit (or open later inside your window, labeled "Opens at 5 PM"). A show only counts if you'd get there no more than 15 minutes after it starts. Cards show it plainly: *"🚇 ~14 min by T · Open till 9 PM"*. Hours for the curated places are **approximate** (`backend/src/data/hours.ts`) unless you add a `GOOGLE_PLACES_API_KEY`, in which case Google's real opening hours are used.

**Events are real events.** "Event" only ever means a dated listing from a live source that starts within your window (or up to 30 minutes before it), never a venue that might have something on. Food and activities come from the curated places (plus live exhibits and workshops that are open during your window).

**Who you are matters a little.** Students get a nudge toward campus events and free/cheap picks; locals away from tourist traps and toward locally owned spots; visitors and newcomers toward the Boston classics.

**Constraint relaxation:** if the exact filters can't produce two options, it loosens one step at a time and **labels what it stretched**: exact → next-door neighborhood → (places only) outside their usual hours or a bit longer than your time → one tier over budget → repeats.

**Diversity:** B is the best option that *differs* from A (neighborhood or vibe) when it's close in score, so it's a real choice.

**Groups:** every rider's interest is scored separately and combined as `0.6·(least-happy rider) + 0.4·(average)`, so nobody gets dragged somewhere they'd hate. The budget is capped at the lowest rider's comfort level, and anywhere the group has already been is skipped.

**Group matching** (`services.ts → matchCrew`): if someone else is forming a group at the same spot (within 6 hours), you join theirs. That's how two real users get matched. Otherwise a new group starts and invites the most compatible locals (shared interests, similar age, would like this place). New groups are named after where they met (e.g. "Regina Pizzeria group"), and any member can rename one with the pencil next to its name; the chat notes who renamed it. Groups that still have an old auto-generated name are renamed this way on startup.

## Project structure

```
backend/                 Node + Express + TypeScript
  src/data/places.ts     106 curated Boston spots (address, lat/lng, T stop, local tip)
  src/data/meta.ts       neighborhoods + adjacency, price tiers, durations, tags
  src/data/seedUsers.ts  simulated locals + starter feed posts (for demos)
  src/live/              today's real events: sources, Boston time, location + T stop inference
  src/catalog.ts         curated places + live events + saved picks, in one lookup
  src/recommender.ts     the algorithm
  src/services.ts        auth, taste profiles, group matching, group profiles
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
| POST | `/api/plans` | take a pick (forms a group if `groupMode`) |
| POST | `/api/plans/:id/complete` | rating, private notes, optional feed post |
| GET | `/api/live` | live-event counts (today + next two weeks) and each source's status |
| GET | `/api/plans/:id/calendar.ics` | one plan as a calendar file (Apple Calendar, Outlook) |
| GET | `/api/me/calendar` → `/api/calendar/<token>.ics` | private feed of everything on My line, for calendar subscriptions |
| GET | `/api/history`, `/api/feed?scope=following\|everyone` | |
| GET/POST | `/api/users/:id`, `/api/users/:id/follow`, `/api/people/suggested` | profiles and following |
| GET/POST | `/api/saved`, `/api/saved/:placeId` | spots saved from the feed |
| POST | `/api/feed/:id/react` | `like` / `want` (both shape recommendations) |
| GET/POST | `/api/groups/:id`, `/keep`, `/messages`, `/join-current`, `/leave` | group profile + chat |

## Notes and honest caveats

- **Curated places are real; details are approximate.** Prices, hours and seasons in the catalog are best-effort for a demo. Live events come straight from their sources, but listings change, so check the event page before you go.
- **The group members you meet in a solo demo are simulated locals** (flagged `isDemo`), so one person can demo groups. Two real accounts that take the same spot with "Find me a group" on **will** be matched together.
- **Guest mode is for demos:** it skips sign-up (and the 18+ check), and logging out ends the guest account. Real accounts must be 18+. Every catalog spot is a public venue.
- Auth is simple (scrypt-hashed passwords, bearer tokens): fine for a hackathon, not production-hardened.
- Maps use OpenStreetMap embeds (grayscale, with our own station pin) and Google Maps links. No API keys needed.

## Where it could go next

- More live sources: any Localist calendar (add it to `KNOWN_LOCALIST` in `backend/src/live/sources/localist.ts`) or WordPress "The Events Calendar" site (`KNOWN_WP_EVENTS` in `wpEvents.ts`). Harvard and Tufts have their calendar APIs turned off, and the Greenway, BPL and city calendars don't publish a feed we can use
- Real-time T arrivals from the MBTA V3 API on the station sign ("Next Orange Line: 4 min")
- Skill levels for activities (beginner → expert) to match people learning the same thing
- Identity verification at onboarding; real-time chat over WebSockets
- Native app (the UI is already phone-first)
