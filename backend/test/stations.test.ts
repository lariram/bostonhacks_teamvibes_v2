import { describe, expect, it } from 'vitest';
import { ROUTES, STATIONS, stationShortName, tStopBingo } from '../src/live/stations.js';

describe('T stop bingo', () => {
  it('every route stop is a known station, and every station is on a route', () => {
    const names = new Set(STATIONS.map((s) => stationShortName(s[0])));
    const onRoutes = new Set(ROUTES.flatMap((r) => r.stops));
    expect([...onRoutes].filter((n) => !names.has(n))).toEqual([]);
    expect([...names].filter((n) => !onRoutes.has(n))).toEqual([]);
    expect(names.size).toBe(STATIONS.length);
  });

  it('checks off the nearest stop to each place you went', () => {
    // Fenway Park and Harvard Yard
    const b = tStopBingo([
      { lat: 42.3467, lng: -71.0972 },
      { lat: 42.3745, lng: -71.1172 },
    ]);
    const on = b.stops.filter((s) => s.visited).map((s) => s.name);
    expect(on).toContain('Harvard');
    expect(on).toHaveLength(2);
    expect(b.visited).toBe(2);
    expect(b.total).toBe(STATIONS.length);
    expect(b.byLine.find((l) => l.line === 'red')!.visited).toBe(1);
    expect(b.stops.find((s) => s.name === 'Park Street')!.lines.sort()).toEqual(['green', 'red']);
  });

  it('ignores places far from any stop', () => {
    expect(tStopBingo([{ lat: 42.6, lng: -71.4 }]).visited).toBe(0);
  });
});
