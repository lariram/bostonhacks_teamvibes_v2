import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { Catalog } from '../src/catalog.js';
import { PLACES } from '../src/data/places.js';
import { Db } from '../src/db.js';
import { neighborhoodForAddress, neighborhoodForPoint } from '../src/live/geo.js';
import { LiveEvents, liveSourcesFromEnv } from '../src/live/liveEvents.js';
import { normalizeGoogleEvents, parseWhen } from '../src/live/sources/googleEvents.js';
import { KNOWN_LOCALIST, normalizeLocalist } from '../src/live/sources/localist.js';
import { normalizeTicketmaster } from '../src/live/sources/ticketmaster.js';
import type { LiveSource } from '../src/live/sources/types.js';
import { bostonDay, bostonParts, bostonWallTime, formatBostonTime, parseClock, timesForRange } from '../src/live/time.js';
import { recommend } from '../src/recommender.js';
import type { Place } from '../src/types.js';

const TODAY = '2026-11-22';
const NOON = new Date('2026-11-22T12:00:00-05:00');
const ctx = { today: TODAY, now: NOON };
const MIT = KNOWN_LOCALIST.find((c) => c.domain === 'calendar.mit.edu')!;

describe('Boston time', () => {
  it('handles winter and summer offsets', () => {
    expect(bostonWallTime('2026-11-22', 19, 30).toISOString()).toBe('2026-11-23T00:30:00.000Z'); // EST
    expect(bostonWallTime('2026-07-04', 19, 30).toISOString()).toBe('2026-07-04T23:30:00.000Z'); // EDT
  });

  it('knows what "today" is in Boston even late at night UTC', () => {
    const lateNight = new Date('2026-11-23T03:30:00Z'); // 10:30 PM Nov 22 in Boston
    expect(bostonParts(lateNight).date).toBe('2026-11-22');
    const day = bostonDay(lateNight);
    expect(day.start.toISOString()).toBe('2026-11-22T05:00:00.000Z');
  });

  it('buckets ranges and parses clock times', () => {
    expect(timesForRange(bostonWallTime(TODAY, 10), bostonWallTime(TODAY, 16))).toEqual(['morning', 'afternoon']);
    expect(parseClock('Time: 12:30 PM')).toEqual([12, 30]);
    expect(parseClock('7pm')).toEqual([19, 0]);
    expect(parseClock('Room 12')).toBeNull();
    expect(formatBostonTime(bostonWallTime(TODAY, 19, 30))).toBe('7:30 PM');
  });
});

describe('geo', () => {
  it('maps venues to neighborhoods and drops far-away ones', () => {
    expect(neighborhoodForPoint(42.3743, -71.1209)).toBe('cambridge'); // The Sinclair
    expect(neighborhoodForPoint(42.3662, -71.0621)).toBe('downtown'); // TD Garden
    expect(neighborhoodForPoint(42.0909, -71.2643)).toBeNull(); // Gillette Stadium
    expect(neighborhoodForAddress('52 Church St, Cambridge, MA 02138')).toBe('cambridge');
    expect(neighborhoodForAddress('Somerville, MA')).toBe('somerville');
    expect(neighborhoodForAddress('Norton, MA')).toBeNull();
  });
});

describe('Localist (university calendars)', () => {
  const ev = (over: Record<string, unknown>) => ({
    event: {
      id: Math.floor(Math.random() * 1e9),
      title: 'Thing',
      experience: 'inperson',
      status: 'live',
      location_name: '',
      address: '',
      free: false,
      ticket_cost: null,
      description_text: '',
      geo: { latitude: null, longitude: null },
      filters: { event_types: [] },
      localist_url: 'https://calendar.mit.edu/event/x',
      event_instances: [{ event_instance: { id: 1, start: '2026-11-22T19:00:00-05:00', end: '2026-11-22T21:00:00-05:00', all_day: false } }],
      ...over,
    },
  });

  it('keeps home games with the real time, drops away games', () => {
    const json = {
      events: [
        ev({
          title: 'Field Hockey vs. Babson College',
          description_text: 'Time: 12:00 PM\n\n Location: Cambridge, MA',
          filters: { event_types: [{ name: 'Athletics/Recreation' }] },
          event_instances: [{ event_instance: { id: 2, start: '2026-11-22T01:00:00-05:00', end: null, all_day: false } }],
        }),
        ev({
          title: "Men's Soccer vs. Wheaton College",
          description_text: 'Time: 12:30 PM\n\n Location: Norton, MA',
          filters: { event_types: [{ name: 'Athletics/Recreation' }] },
          event_instances: [{ event_instance: { id: 3, start: '2026-11-22T01:00:00-05:00', end: null, all_day: false } }],
        }),
      ],
    };
    const out = normalizeLocalist(json, MIT, ctx);
    expect(out).toHaveLength(1);
    expect(out[0].neighborhood).toBe('cambridge');
    expect(formatBostonTime(new Date(out[0].live!.startsAt))).toBe('12 PM');
    expect(out[0].tags).toContain('College sports');
  });

  it('skips seminars, virtual events and other days', () => {
    const json = {
      events: [
        ev({ title: 'Distinguished Seminar in Fluid Dynamics', location_name: 'Building 10', filters: { event_types: [{ name: 'Conferences/Seminars/Lectures' }] } }),
        ev({ title: 'Movie night', location_name: 'Building 10', experience: 'virtual' }),
        ev({
          title: 'Choir concert',
          location_name: 'Kresge',
          event_instances: [{ event_instance: { id: 9, start: '2026-11-23T19:00:00-05:00', end: null, all_day: false } }],
        }),
      ],
    };
    expect(normalizeLocalist(json, MIT, ctx)).toHaveLength(0);
  });

  it('turns all-day exhibits into activities and reads "free"', () => {
    const json = {
      events: [
        ev({
          title: 'Light & Shadow exhibition',
          location_name: 'MIT Museum',
          ticket_cost: 'FREE and open to the public',
          filters: { event_types: [{ name: 'Exhibits' }] },
          geo: { latitude: '42.3624', longitude: '-71.0866' },
          event_instances: [{ event_instance: { id: 4, start: '2026-11-22T00:00:00-05:00', end: null, all_day: true } }],
        }),
      ],
    };
    const [p] = normalizeLocalist(json, MIT, ctx);
    expect(p.type).toBe('activity');
    expect(p.price).toBe('free');
    expect(p.tags).toContain('Museums');
    expect(p.times).toEqual(['morning', 'afternoon']);
  });

  it('keeps campus events on campus even near the river', () => {
    const json = { events: [ev({ title: 'Crafternoon', location_name: 'Building W97', geo: { latitude: '42.354653', longitude: '-71.1036' } })] };
    expect(normalizeLocalist(json, MIT, ctx)[0].neighborhood).toBe('cambridge');
  });
});

describe('Ticketmaster', () => {
  const venue = (lat: string, lng: string, zip = '02138') => ({
    name: 'The Sinclair',
    postalCode: zip,
    address: { line1: '52 Church St' },
    city: { name: 'Cambridge' },
    state: { stateCode: 'MA' },
    location: { latitude: lat, longitude: lng },
  });
  const tm = (over: Record<string, unknown>) => ({
    id: String(Math.random()),
    name: 'Indie Band',
    url: 'https://www.ticketmaster.com/event/1',
    dates: { start: { localDate: TODAY, localTime: '20:00:00', dateTime: '2026-11-23T01:00:00Z' }, status: { code: 'onsale' } },
    classifications: [{ segment: { name: 'Music' }, genre: { name: 'Rock' } }],
    priceRanges: [{ min: 25, max: 35 }],
    _embedded: { venues: [venue('42.3743', '-71.1209')] },
    ...over,
  });

  it('normalizes shows and filters out the noise', () => {
    const json = {
      _embedded: {
        events: [
          tm({}),
          tm({ name: 'Indie Band - VIP Package' }), // duplicate package
          tm({ name: 'Cancelled Show', dates: { start: { dateTime: '2026-11-23T01:00:00Z' }, status: { code: 'cancelled' } } }),
          tm({ name: 'Patriots vs. Jets', _embedded: { venues: [venue('42.0909', '-71.2643', '02035')] } }), // Foxborough
          tm({ name: 'Comedy Night', classifications: [{ segment: { name: 'Arts & Theatre' }, genre: { name: 'Comedy' } }], priceRanges: undefined }),
        ],
      },
    };
    const out = normalizeTicketmaster(json, ctx);
    expect(out.map((p) => p.name)).toEqual(['Indie Band', 'Comedy Night']);
    const [band, comedy] = out;
    expect(band.neighborhood).toBe('cambridge');
    expect(band.price).toBe('20to40');
    expect(band.priceNote).toBe('$25–$35');
    expect(band.tags).toContain('Live music');
    expect(band.times).toEqual(['evening', 'late']); // 8–10:30 PM
    expect(comedy.tags).toContain('Comedy');
    expect(comedy.priceNote).toMatch(/not listed/);
  });
});

describe('Google Events (SerpApi)', () => {
  it('parses Google time ranges', () => {
    const r = parseWhen('Sat, Nov 22, 7 – 10 PM', TODAY)!;
    expect(formatBostonTime(r.start)).toBe('7 PM');
    expect(formatBostonTime(r.end!)).toBe('10 PM');
    const late = parseWhen('Sat, Nov 22, 10 PM – 2 AM', TODAY)!;
    expect(late.end!.getTime()).toBeGreaterThan(late.start.getTime());
    expect(parseWhen('Sat, Nov 22', TODAY)).toBeNull();
    expect(formatBostonTime(parseWhen('Sat, Nov 22, 11 AM – 1 PM', TODAY)!.start)).toBe('11 AM');
    expect(formatBostonTime(parseWhen('Today, 8 PM', TODAY)!.start)).toBe('8 PM');
  });

  it('normalizes listings and places them by address', () => {
    const out = normalizeGoogleEvents(
      {
        events_results: [
          {
            title: 'Free Jazz Night',
            date: { start_date: 'Nov 22', when: 'Sat, Nov 22, 7:30 – 9:30 PM' },
            address: ['Lizard Lounge, 1667 Massachusetts Ave', 'Cambridge, MA 02138'],
            link: 'https://example.com/jazz',
            description: 'Live jazz trio.',
          },
          { title: 'Somewhere far', date: { when: 'Sat, Nov 22, 8 PM' }, address: ['Worcester, MA 01608'], link: 'https://example.com' },
        ],
      },
      ctx,
    );
    expect(out).toHaveLength(1);
    expect(out[0].price).toBe('free');
    expect(out[0].tags).toContain('Live music');
    expect(out[0].live!.approxLocation).toBe(true);
  });
});

function livePlace(over: Partial<Place> & { startsAt: string; source?: 'ticketmaster' | 'localist' | 'google' }): Place {
  const { startsAt, source = 'ticketmaster', ...rest } = over;
  return {
    id: `live-test-${Math.random()}`,
    name: 'Test Show',
    type: 'event',
    neighborhood: 'cambridge',
    price: '10to20',
    priceNote: '$15',
    minutes: 120,
    tags: ['Live music'],
    times: ['evening'],
    address: '1 Main St, Cambridge, MA',
    lat: 42.3736,
    lng: -71.119,
    tStop: 'Harvard (Red)',
    emoji: '🎶',
    blurb: 'A show.',
    localTip: '',
    live: { source, sourceName: source, url: 'https://example.com', startsAt, endEstimated: true, fetchedAt: NOON.toISOString() },
    ...rest,
  };
}

const fakeSource = (id: string, places: Place[] | Error): LiveSource => ({
  id,
  name: id,
  refreshMs: 60 * 60 * 1000,
  fetch: async () => {
    if (places instanceof Error) throw places;
    return places;
  },
});

describe('LiveEvents cache', () => {
  it('survives a failing source, drops finished events and de-dupes', async () => {
    const tonight = bostonWallTime(TODAY, 20).toISOString();
    const live = new LiveEvents(
      [
        fakeSource('ticketmaster', [
          livePlace({ name: 'Indie Band', startsAt: tonight }),
          livePlace({ name: 'Morning Show', startsAt: bostonWallTime(TODAY, 9).toISOString() }), // over
        ]),
        fakeSource('google', [livePlace({ name: 'Indie band!', startsAt: tonight, source: 'google' })]), // same show
        fakeSource('broken', new Error('HTTP 500 from example.com')),
      ],
      { now: () => NOON, quiet: true },
    );
    await live.refresh();
    const names = live.events().map((p) => `${p.name}/${p.live!.source}`);
    expect(names).toEqual(['Indie Band/ticketmaster']);
    const status = live.status();
    expect(status.sources.find((s) => s.id === 'broken')).toMatchObject({ ok: false, error: 'HTTP 500 from example.com' });
    expect(status.total).toBe(1);
  });

  it('only uses university calendars unless keys are set', () => {
    expect(liveSourcesFromEnv({}).map((s) => s.id)).toEqual(['localist:calendar.mit.edu', 'localist:calendar.northeastern.edu']);
    expect(liveSourcesFromEnv({ TICKETMASTER_API_KEY: 'k', SERPAPI_API_KEY: 'k' }).map((s) => s.id)).toContain('ticketmaster');
    expect(liveSourcesFromEnv({ LIVE_EVENTS: 'off' })).toEqual([]);
  });
});

describe('live events in recommendations', () => {
  it('boosts tonight’s real show and says when it starts', async () => {
    const soon = new Date(NOON.getTime() + 40 * 60_000).toISOString();
    const show = livePlace({ name: 'Lunchtime Jazz', startsAt: soon, times: ['afternoon'], minutes: 60, price: 'free', priceNote: 'Free' });
    const r = recommend(
      { location: 'cambridge', type: 'event', price: 'free', duration: 'short', timeOfDay: 'afternoon' },
      {
        places: [...PLACES, show],
        members: [{ id: 'a', firstName: 'A', prefs: new Set(['Live music']), weights: {}, doneIds: new Set(), wantIds: new Set() }],
        now: NOON,
        random: () => 0.5,
      },
    );
    expect(r.suggestions[0].place.name).toBe('Lunchtime Jazz');
    expect(r.suggestions[0].reasons[0]).toBe('Starts in 40 min');
  });

  it('hides a generic venue entry when that venue has a real show today', async () => {
    const sinclairShow = livePlace({ name: 'Real Band at The Sinclair', startsAt: bostonWallTime(TODAY, 20).toISOString(), lat: 42.3743, lng: -71.1209 });
    const live = new LiveEvents([fakeSource('ticketmaster', [sinclairShow])], { now: () => NOON, quiet: true });
    await live.refresh();
    const ids = new Catalog(new Db(null), live).candidates(NOON).map((p) => p.id);
    expect(ids).toContain(sinclairShow.id);
    expect(ids).not.toContain('sinclair');
  });

  it('remembers a picked live event after it leaves the cache', async () => {
    const show = livePlace({ name: 'One Night Only', startsAt: bostonWallTime(TODAY, 20).toISOString() });
    const db = new Db(null);
    const live = new LiveEvents([fakeSource('ticketmaster', [show])], { now: () => NOON, quiet: true });
    await live.refresh();
    const app = createApp(db, { live, now: () => NOON, random: () => 0.5 });
    const { body: auth } = await request(app).post('/api/auth/guest');
    const authed = (r: request.Test) => r.set('Authorization', `Bearer ${auth.token}`);

    const status = await request(app).get('/api/live');
    expect(status.body.total).toBe(1);
    expect(status.body.upcoming[0].name).toBe('One Night Only');

    const plan = await authed(request(app).post('/api/plans')).send({
      placeId: show.id,
      request: { location: 'cambridge', type: 'event', price: '40plus', duration: 'half' },
    });
    expect(plan.status).toBe(200);
    expect(plan.body.place.live.sourceName).toBe('ticketmaster');

    // a fresh app with an empty live cache still knows the place
    const later = createApp(db, { live: new LiveEvents([], { quiet: true }), now: () => NOON });
    const history = await request(later).get('/api/history').set('Authorization', `Bearer ${auth.token}`);
    expect(history.body[0].place.name).toBe('One Night Only');
  });
});
