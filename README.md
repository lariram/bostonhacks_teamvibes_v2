# common. (Boston, better together)

**BostonHacks 2026 · Team Vibes · Track: Boundless Boston**

Boston is America's college city: 35+ campuses, a quarter-million students, and most of them never leave their bubble. BU kids stay on Comm Ave, Harvard kids stay in the Square, and the people who've lived here their whole lives rarely meet either.

**common** fixes both problems at once:

1. **Tell it what you've got.** Pick a neighborhood, event/activity/food, a budget (Free → $40+) and how much time you have. It gives you **two** great options, curated from real Boston spots with T stops and local tips. Not into either? Regenerate, and tell it what you'd rather have.
2. **Turn on "Form a group."** When you pick a spot, you're matched with other Bostonians heading there. A crew forms around your first stop of the day.
3. **Keep the crew.** Liked them? Keep the group together for the rest of the day. The group gets its own **group profile**, and the algorithm only suggests things that work for *every* member's tastes and budget.

Rate what you did (5 stars + a private review), post it to the public feed, and fill in your **Boston Bingo** card as you explore all 12 neighborhoods.

> Working name. Change `APP_NAME` in `frontend/src/config.ts` and it updates everywhere.

---

## Quick start

Requires **Node 20.19+ or 22.12+**.

```bash
npm install
```

```bash
npm run dev
```

Then open **http://localhost:5173** (best in a phone-sized window or your browser's device toolbar).

- API runs on `:3001`, web on `:5173` (Vite proxies `/api`).
- Data is stored in `backend/data/db.json` (gitignored). Delete it to reset. The app re-seeds demo locals and feed posts on start.

Other scripts:

```bash
npm test            # backend unit + API tests (vitest)
npm run typecheck   # both apps
npm run build       # production build of the web app
npm start           # one server on :3001 serving the API + built web app
```

## 2-minute demo script

1. **Create Account** → **Choose Preferences** (e.g. Chinese, Dessert, Live music, Nature).
2. **Discover**: Chinatown · Food · $10–$20 · Evening · 1–2 hrs · **Form a group: Yes** → Generate.
3. Point out the **reason chips** ("You're into Chinese", "Right in Chinatown"). The algorithm explains itself.
4. **Generate new recommendations** → the feedback sheet → tap "Japanese" → it finds hot pot and flags it as *a little over budget* instead of ignoring you.
5. **Pick one** → map, address, nearest T, local tip, and **your crew** (3 Bostonians from different schools) → open the **group chat**.
6. **Finished? Rate it** → 5 stars, private review, post to feed.
7. **"Want another activity with the same group?"** → name the crew → the generator now shows *"Capped at $10–$20 so it works for everyone"* and suggestions say things like *"Lari, Maya & Hana love live music"*.
8. **Feed** (save a spot → it boosts your future recs), **History**, **Profile** (Boston Bingo, your crews, "We've noticed you love…").

## How the recommendation algorithm works

`backend/src/recommender.ts` is pure functions, fully unit-tested.

**Scoring.** Each candidate gets
`0.40·interest + 0.25·location + 0.15·price fit + 0.10·duration fit`
plus small boosts for community ratings, in-season items, and anything you asked for in feedback, plus a little jitter so regenerate feels alive.

- **Interest** comes from your onboarding tags, plus **learned weights**: 5★ ratings push a place's tags up, 1★ pushes them down; liking or saving feed posts nudges them too.
- **Location**: same neighborhood > adjacent (a quick T hop) > elsewhere.
- Out-of-season things (Swan Boats in November) are never suggested.

**Constraint relaxation.** If the exact filters can't produce two options, it loosens one step at a time and **labels what it stretched**:
exact → ignore time-of-day / allow a slightly longer outing → anywhere in the city → one tier over budget → repeats.

**Diversity.** Pick #2 is the best option that *differs* from pick #1 (neighborhood or vibe) when it's close in score, so you get a real choice.

**Groups.** Every member's interest score is computed separately, then combined as
`0.6·(least-happy member) + 0.4·(average)`
so nobody gets dragged somewhere they'd hate. The budget is capped at the **lowest** member's comfort level, and anywhere the group has already been is skipped.

**Crew matching** (`services.ts → matchCrew`). If someone else is forming a crew at the same spot (within 6 hours), you join theirs. That's how two real users get matched. Otherwise a new crew starts and invites the most compatible locals (shared interests, similar age, would like this place).

## Project structure

```
backend/                 Node + Express + TypeScript
  src/data/places.ts     ~100 curated Boston spots (address, lat/lng, T stop, tips)
  src/data/meta.ts       neighborhoods + adjacency, price tiers, durations, tags
  src/data/seedUsers.ts  simulated locals + starter feed posts (for demos)
  src/recommender.ts     the algorithm
  src/services.ts        auth, taste profiles, crew matching, group profiles
  src/app.ts             REST API
  test/                  vitest: algorithm + full end-to-end API flow
frontend/                React + Vite + TypeScript (mobile-first)
  src/pages/             Start, Login, Signup, Onboarding, Discover, Results,
                         PlanDetails, Rate, Next, Feed, History, Profile, GroupPage
  src/components/        chips, cards, nav bar, stars, avatars, bottom sheet
  src/styles.css         design tokens from the Figma moodboard
```

**Design** follows the Figma file: the moodboard's Boston-sports palette (Red Sox red `#CB2930`, Patriots navy `#002A5C`, Celtics green `#00834A`, silver, purple, orange), Helvetica Neue Bold / Medium (-2%) / Light, pill chips, and the four-tab nav (feed · discover · history · profile). Types are color-coded: **event** purple, **activity** green, **food** orange.

## API overview

| Method | Path | What |
| --- | --- | --- |
| GET | `/api/meta` | neighborhoods, types, price tiers, durations, tags |
| POST | `/api/auth/signup`, `/api/auth/login` | returns a bearer token |
| GET/PUT | `/api/me`, `/api/me/preferences` | profile, stats, Boston Bingo |
| POST | `/api/recommendations` | `{location,type,price,duration,timeOfDay?,groupMode?,groupId?,excludeIds?,feedback?}` → 2 suggestions |
| POST | `/api/plans` | choose a suggestion (forms a crew if `groupMode`) |
| POST | `/api/plans/:id/complete` | rating, private review, optional feed post |
| GET | `/api/history`, `/api/feed` | |
| POST | `/api/feed/:id/react` | `like` / `want` (both shape recommendations) |
| GET/POST | `/api/groups/:id`, `/keep`, `/messages`, `/join-current`, `/leave` | group profile + chat |

## Notes and honest caveats

- **Places are real; details are approximate.** Prices, hours and seasons are best-effort for a demo. Verify before relying on them. Events are modeled as venues and recurring happenings ("what's on tonight at the Sinclair") so the catalog doesn't go stale.
- **The crew members you meet in a solo demo are simulated locals** (flagged `isDemo` in the DB), so one person can demo group matching. Two real accounts that pick the same spot with "Form a group" on **will** be matched together.
- Users must be 18+. Every catalog spot is a public venue. Auth is simple (scrypt-hashed passwords, bearer tokens), fine for a hackathon but not production-hardened.
- Maps use OpenStreetMap embeds and Google Maps links (no API keys needed).

## Where it could go next

- Live events from Eventbrite / Ticketmaster / venue calendars layered onto the same `Place` shape
- Skill levels for activities (beginner → expert) to match people learning the same thing (from our moodboard)
- Identity verification at onboarding; real-time chat over WebSockets
- AI-written "why you'll like it" blurbs and smarter learning from feed reactions
- Native app (the UI is already phone-first)
