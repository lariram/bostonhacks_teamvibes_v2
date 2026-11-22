import { describe, expect, it } from 'vitest';
import { PLACES } from '../src/data/places.js';
import { parseHours, scheduleFromGoogle, visitWindow } from '../src/hours.js';
import { bostonWallTime, formatBostonTime } from '../src/live/time.js';
import { recommend, type TasteProfile } from '../src/recommender.js';
import { estimateTravel } from '../src/travel.js';
import type { RecRequest } from '../src/types.js';

const SAT = '2026-11-21'; // a Saturday
const at = (h: number, m = 0, day = SAT) => bostonWallTime(day, h, m);
const me: TasteProfile[] = [{ id: 'a', firstName: 'A', prefs: new Set(), weights: {}, doneIds: new Set(), wantIds: new Set() }];
const ask = (req: Partial<RecRequest>, now = at(9)) =>
  recommend({ location: 'somerville', type: 'food', price: '40plus', durationMinutes: 60, ...req } as RecRequest, {
    places: PLACES,
    members: me,
    now,
    random: () => 0.5,
  });

describe('opening hours', () => {
  it('parses days, ranges and past-midnight closes', () => {
    const w = parseHours('Mo-Th,Su 11:00-23:30; Fr,Sa 11:00-24:30');
    expect(w[1]).toEqual([[660, 1410]]); // Monday
    expect(w[6]).toEqual([[660, 1470]]); // Saturday, till 12:30 AM
    expect(parseHours('Sa 09:00-13:00')[6]).toEqual([[540, 780]]);
  });

  it('knows a late-night spot is still open just after midnight', () => {
    const w = parseHours('Fr,Sa 11:00-26:00'); // Pinocchio's-style
    const v = visitWindow(w, bostonWallTime('2026-11-22', 0, 30), bostonWallTime('2026-11-22', 1, 30)); // Sun 12:30 AM
    expect(v).not.toBeNull();
    expect(formatBostonTime(v!.until)).toBe('2 AM');
  });

  it('reads Google Places hours', () => {
    const w = scheduleFromGoogle([{ open: { day: 5, hour: 17 }, close: { day: 6, hour: 1, minute: 30 } }]);
    expect(w[5]).toEqual([[1020, 1530]]);
  });

  it("never suggests somewhere that'll be closed when you get there", () => {
    // Union Square Donuts closes at 2 PM: fine in the morning, gone in the afternoon
    const morning = ask({ startAt: at(9).toISOString() }).suggestions.map((s) => s.place.id);
    const afternoon = ask({ startAt: at(15).toISOString() }, at(14)).suggestions.map((s) => s.place.id);
    expect(afternoon).not.toContain('union-donuts');
    for (const s of ask({ startAt: at(15).toISOString() }, at(14)).suggestions) {
      expect(new Date(s.openUntil!).getTime()).toBeGreaterThan(new Date(s.arriveAt!).getTime());
    }
    expect(morning.length).toBeGreaterThan(0);
  });

  it('says when somewhere opens later in your window', () => {
    // 4 PM–7 PM in Somerville: Sarma (dinner from 5 PM) can be suggested with "Opens at 5 PM"
    const r = ask({ location: 'somerville', startAt: at(16).toISOString(), durationMinutes: 180, feedback: { moreTags: ['Mediterranean'] } }, at(15));
    const sarma = r.suggestions.find((s) => s.place.id === 'sarma');
    if (sarma) expect(sarma.stretchNote).toContain('Opens at 5 PM');
  });

  it('skips places that are closed that day', () => {
    // The ICA is closed Mondays
    const mon = '2026-11-23';
    const ids = ask({ location: 'seaport', type: 'activity', startAt: at(11, 0, mon).toISOString(), durationMinutes: 120 }, at(10, 0, mon)).suggestions.map(
      (s) => s.place.id,
    );
    expect(ids).not.toContain('ica');
  });
});

describe('travel time', () => {
  it('walks short hops and takes the T for longer ones', () => {
    expect(estimateTravel([42.3647, -71.0542], [42.3654, -71.0573]).mode).toBe('walk');
    const t = estimateTravel([42.3734, -71.1189], [42.3555, -71.0605]);
    expect(t.mode).toBe('T');
    expect(t.minutes).toBeGreaterThan(12);
    expect(t.minutes).toBeLessThan(35);
  });

  it('judges hours at the moment you would arrive, from where you are', () => {
    // Leaving Harvard at 1:40 PM for Somerville donuts that close at 2 PM: you won't make it
    const r = ask({ startAt: at(13, 40).toISOString(), from: { lat: 42.3734, lng: -71.1189 } }, at(13, 30));
    expect(r.suggestions.map((s) => s.place.id)).not.toContain('union-donuts');
    for (const s of r.suggestions) expect(s.travel?.fromYou).toBe(true);
  });
});
