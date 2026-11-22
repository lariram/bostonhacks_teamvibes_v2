import { describe, expect, it } from 'vitest';
import { PLACES } from '../src/data/places.js';
import { NEIGHBORHOOD_BY_ID, PREFERENCE_TAGS, priceRank } from '../src/data/meta.js';
import { groupInterest, recommend, type TasteProfile } from '../src/recommender.js';
import type { RecRequest } from '../src/types.js';

const NOV = new Date('2026-11-21T15:00:00');
const fixedRandom = () => 0.5;

function person(id: string, prefs: string[], extra: Partial<TasteProfile> = {}): TasteProfile {
  return { id, firstName: id, prefs: new Set(prefs), weights: {}, doneIds: new Set(), wantIds: new Set(), ...extra };
}

const base: RecRequest = { location: 'chinatown', type: 'food', price: '10to20', duration: 'short', timeOfDay: 'evening' };

describe('catalog', () => {
  it('has unique ids and only known tags', () => {
    const ids = new Set(PLACES.map((p) => p.id));
    expect(ids.size).toBe(PLACES.length);
    const known = new Set(Object.values(PREFERENCE_TAGS).flat());
    for (const p of PLACES) {
      for (const t of p.tags) expect(known.has(t), `${p.id} has unknown tag ${t}`).toBe(true);
      expect(NEIGHBORHOOD_BY_ID[p.neighborhood], p.id).toBeTruthy();
    }
  });

  it('can produce two food and activity picks for every neighborhood with a generous budget', () => {
    for (const hood of Object.keys(NEIGHBORHOOD_BY_ID)) {
      for (const type of ['food', 'activity'] as const) {
        const r = recommend(
          { location: hood as RecRequest['location'], type, price: '40plus', duration: 'half' },
          { places: PLACES, members: [person('a', [])], now: NOV, random: fixedRandom },
        );
        expect(r.suggestions.length, `${hood}/${type}`).toBe(2);
      }
    }
  });
});

describe('recommend', () => {
  it('never suggests a venue as an "event": only real, dated events', () => {
    const r = recommend(
      { location: 'theater', type: 'event', price: '40plus', duration: 'half' },
      { places: PLACES, members: [person('a', ['Performing arts'])], now: NOV, random: fixedRandom },
    );
    expect(r.suggestions).toHaveLength(0);
  });

  it('stays in your neighborhood or right next door, never across town', () => {
    for (const hood of Object.keys(NEIGHBORHOOD_BY_ID) as (keyof typeof NEIGHBORHOOD_BY_ID)[]) {
      const allowed = [hood, ...NEIGHBORHOOD_BY_ID[hood].near];
      for (const type of ['food', 'activity'] as const) {
        const r = recommend(
          { location: hood, type, price: 'free', duration: 'quick', timeOfDay: 'late' }, // hard to satisfy
          { places: PLACES, members: [person('a', [])], now: NOV, random: fixedRandom },
        );
        for (const s of r.suggestions) expect(allowed, `${hood}/${type} → ${s.place.id}`).toContain(s.place.neighborhood);
      }
    }
  });

  it('prefers your own neighborhood over next door', () => {
    const r = recommend(
      { location: 'northend', type: 'food', price: '40plus', duration: 'short', timeOfDay: 'evening' },
      { places: PLACES, members: [person('a', [])], now: NOV, random: fixedRandom },
    );
    expect(r.suggestions.every((s) => s.place.neighborhood === 'northend')).toBe(true);
  });

  it('leans on who you are', () => {
    const base = { location: 'downtown' as const, type: 'food' as const, price: '10to20' as const, duration: 'short' as const, timeOfDay: 'afternoon' as const };
    const forPersona = (persona: 'local' | 'visitor') =>
      recommend(base, { places: PLACES, members: [person('a', [], { persona })], now: NOV, random: fixedRandom }).suggestions.map(
        (s) => s.place.id,
      );
    expect(forPersona('visitor')).toContain('quincy-market'); // a classic for visitors
    expect(forPersona('local')).not.toContain('quincy-market'); // locals skip it
  });

  it('returns two distinct suggestions that match type and budget', () => {
    const r = recommend(base, { places: PLACES, members: [person('a', ['Chinese'])], now: NOV, random: fixedRandom });
    expect(r.suggestions).toHaveLength(2);
    const [a, b] = r.suggestions;
    expect(a.place.id).not.toBe(b.place.id);
    for (const s of r.suggestions) {
      expect(s.place.type).toBe('food');
      expect(priceRank(s.place.price)).toBeLessThanOrEqual(priceRank('10to20'));
      expect(s.stretchNote).toBeUndefined();
    }
  });

  it('prefers places matching the person’s interests and explains why', () => {
    const r = recommend(base, { places: PLACES, members: [person('a', ['Chinese', 'Asian'])], now: NOV, random: fixedRandom });
    expect(r.suggestions[0].place.tags).toContain('Chinese');
    expect(r.suggestions[0].reasons.join(' ')).toMatch(/You're into/);
  });

  it('regenerate excludes what was already shown', () => {
    const ctx = { places: PLACES, members: [person('a', ['Chinese'])], now: NOV, random: fixedRandom };
    const first = recommend(base, ctx);
    const shown = first.suggestions.map((s) => s.place.id);
    const second = recommend({ ...base, excludeIds: shown }, ctx);
    for (const s of second.suggestions) expect(shown).not.toContain(s.place.id);
  });

  it('never suggests out-of-season things', () => {
    const r = recommend(
      { location: 'backbay', type: 'activity', price: '40plus', duration: 'quick' },
      { places: PLACES, members: [person('a', ['Seasonal', 'Nature'])], now: NOV, random: fixedRandom },
    );
    // Swan boats only run Apr–Sep
    expect(r.suggestions.map((s) => s.place.id)).not.toContain('swan-boats');
  });

  it('stretches constraints (and says so) when nothing matches exactly', () => {
    // Brighton has no restaurants in the catalog — should fall back to neighbors
    const r = recommend(
      { location: 'brighton', type: 'food', price: '10to20', duration: 'short' },
      { places: PLACES, members: [person('a', [])], now: NOV, random: fixedRandom },
    );
    expect(r.suggestions).toHaveLength(2);
    for (const s of r.suggestions) expect(['brighton', 'allston']).toContain(s.place.neighborhood);
  });

  it('"cheaper" feedback lowers the budget', () => {
    const r = recommend(
      { ...base, price: '20to40', feedback: { cheaper: true } },
      { places: PLACES, members: [person('a', [])], now: NOV, random: fixedRandom },
    );
    expect(r.budget).toBe('10to20');
  });

  it('"more of" feedback steers results toward that tag', () => {
    const r = recommend(
      { ...base, location: 'cambridge', feedback: { moreTags: ['Mexican'] } },
      { places: PLACES, members: [person('a', [])], now: NOV, random: fixedRandom },
    );
    expect(r.suggestions[0].place.tags).toContain('Mexican');
  });

  it('surfaces a requested tag even if it means stretching the budget', () => {
    // The only Japanese spot near Chinatown is one tier over a $10–20 budget
    const r = recommend(
      { ...base, feedback: { moreTags: ['Japanese'] } },
      { places: PLACES, members: [person('a', ['Chinese'])], now: NOV, random: fixedRandom },
    );
    expect(r.suggestions[0].place.tags).toContain('Japanese');
    expect(r.suggestions[0].stretchNote).toMatch(/over budget/);
    expect(r.suggestions).toHaveLength(2);
  });
});

describe('group recommendations', () => {
  it('caps the budget at what every member is comfortable with', () => {
    const r = recommend(
      { location: 'theater', type: 'event', price: '40plus', duration: 'half' },
      {
        places: PLACES,
        members: [person('me', ['Comedy'], { budget: '40plus' }), person('sam', ['Comedy'], { budget: '10to20' })],
        now: NOV,
        random: fixedRandom,
      },
    );
    expect(r.budget).toBe('10to20');
    for (const s of r.suggestions) expect(priceRank(s.place.price)).toBeLessThanOrEqual(priceRank('20to40'));
  });

  it('favors places that work for the least-happy member, not just the average', () => {
    const lover = person('a', ['Seafood', 'Fine dining']);
    const hater = person('b', ['Dessert'], { weights: { Seafood: -1, 'Fine dining': -1 } });
    const neptune = PLACES.find((p) => p.id === 'neptune-oyster')!;
    const mikes = PLACES.find((p) => p.id === 'mikes-pastry')!;
    expect(groupInterest(mikes, [lover, hater])).toBeGreaterThan(groupInterest(neptune, [lover, hater]));
  });

  it('talks to you as "You" in group reasons', () => {
    const r = recommend(
      { location: 'cambridge', type: 'activity', price: 'free', duration: 'short', timeOfDay: 'evening' },
      {
        places: PLACES,
        members: [person('maya', ['Games']), person('me', ['Games']), person('kev', ['History'])],
        now: NOV,
        random: fixedRandom,
        selfId: 'me',
      },
    );
    const text = r.suggestions.flatMap((s) => s.reasons).join(' | ');
    expect(text).toMatch(/You & maya love games/);
    expect(text).not.toMatch(/\bme\b/);
  });

  it('says when everyone shares an interest', () => {
    const r = recommend(
      { location: 'chinatown', type: 'food', price: '20to40', duration: 'short', timeOfDay: 'evening' },
      {
        places: PLACES,
        members: [person('a', ['Chinese']), person('b', ['Chinese', 'Dessert']), person('c', ['Chinese'])],
        now: NOV,
        random: fixedRandom,
      },
    );
    expect(r.suggestions[0].reasons.join(' ')).toMatch(/Everyone's into/);
  });
});
