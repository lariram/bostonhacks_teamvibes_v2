import { describe, expect, it } from 'vitest';
import { generateAgenda } from '../src/agenda.js';
import { NEIGHBORHOOD_BY_ID } from '../src/data/meta.js';
import { PLACES } from '../src/data/places.js';
import { scheduleFor, visitWindow } from '../src/hours.js';
import { distanceKm } from '../src/live/geo.js';

const user: any = { preferences: { food: ['Italian'], event: [], activity: ['Art'] }, tagWeights: {} };
const seeded = (seed: number) => () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
const now = new Date('2026-11-22T12:00:00Z');

describe('surprise agenda', () => {
  it('a stay-put day keeps every stop in one neighborhood, in order, and open when you get there', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { days } = generateAgenda(
        { span: 'day', pace: 'stay', start: 'northend', price: '20to40', date: '2026-11-28' },
        { user, places: PLACES, random: seeded(seed), now },
      );
      const stops = days[0].stops;
      expect(stops.length).toBeGreaterThanOrEqual(3);
      expect(new Set(stops.map((s) => s.place.id)).size).toBe(stops.length);
      for (const [i, s] of stops.entries()) {
        expect(s.place.neighborhood).toBe('northend');
        expect(s.place.type).not.toBe('event'); // no undated "events"
        if (i > 0) {
          expect(Date.parse(s.start)).toBeGreaterThanOrEqual(Date.parse(stops[i - 1].end));
          expect(distanceKm([stops[i - 1].place.lat, stops[i - 1].place.lng], [s.place.lat, s.place.lng])).toBeLessThan(2.2);
        }
        const h = scheduleFor(s.place.id);
        if (h) expect(visitWindow(h.schedule, new Date(s.start), new Date(Date.parse(s.start) + 60_000))).not.toBeNull();
      }
    }
  });

  it('a wandering week only ever moves to a neighboring area', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const { days } = generateAgenda(
        { span: 'week', pace: 'wander', start: 'backbay', price: '40plus', date: '2026-11-23' },
        { user, places: PLACES, random: seeded(seed), now },
      );
      expect(days).toHaveLength(7);
      const route = days.flatMap((d) => d.route).filter((h, i, a) => h !== a[i - 1]);
      expect(route[0]).toBe('backbay');
      for (let i = 1; i < route.length; i++) expect(NEIGHBORHOOD_BY_ID[route[i - 1]].near).toContain(route[i]);
      const ids = days.flatMap((d) => d.stops.map((s) => s.place.id));
      expect(new Set(ids).size).toBe(ids.length); // nothing twice in a week
      expect(days.every((d) => d.stops.length > 0)).toBe(true);
    }
  });

  it('respects the budget', () => {
    const { days } = generateAgenda(
      { span: 'week', pace: 'wander', start: 'cambridge', price: 'free', date: '2026-11-23' },
      { user, places: PLACES, random: seeded(3), now },
    );
    expect(days.flatMap((d) => d.stops).every((s) => s.place.price === 'free')).toBe(true);
  });
});
