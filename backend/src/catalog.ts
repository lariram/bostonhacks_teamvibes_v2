import { PLACES, PLACE_BY_ID } from './data/places.js';
import type { Db } from './db.js';
import { distanceKm } from './live/geo.js';
import type { LiveEvents } from './live/liveEvents.js';
import type { Place } from './types.js';

/**
 * Every place the app knows about: the curated catalog, today's live events,
 * and snapshots of live events people have picked before (so history, the feed
 * and crews keep working after an event drops out of the live cache).
 */
export class Catalog {
  constructor(
    private db: Db,
    readonly live: LiveEvents | null = null,
  ) {}

  get(id: string): Place | undefined {
    return PLACE_BY_ID[id] ?? this.live?.get(id) ?? this.db.data.livePlaces[id];
  }

  remember(place: Place) {
    if (place.live && !this.db.data.livePlaces[place.id]) {
      this.db.data.livePlaces[place.id] = place;
      this.db.save();
    }
  }

  /** What the recommender can choose from right now */
  candidates(now: Date): Place[] {
    const live = this.live?.events(now) ?? [];
    if (!live.length) return PLACES;
    // A real show tonight beats our generic "see what's on at this venue" entry
    const exact = live.filter((l) => l.type === 'event' && !l.live?.approxLocation);
    const hidden = new Set(
      PLACES.filter((p) => p.type === 'event' && exact.some((l) => distanceKm([p.lat, p.lng], [l.lat, l.lng]) < 0.12)).map((p) => p.id),
    );
    return [...PLACES.filter((p) => !hidden.has(p.id)), ...live];
  }
}
