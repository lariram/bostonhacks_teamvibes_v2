import { PLACES, PLACE_BY_ID } from './data/places.js';
import type { Db } from './db.js';
import { distanceKm } from './live/geo.js';
import type { LiveEvents } from './live/liveEvents.js';
import type { Images } from './images.js';
import type { Place } from './types.js';

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Every place the app knows about: the curated catalog, today's live events,
 * and snapshots of live events people have picked before (so history, the feed
 * and groups keep working after an event drops out of the live cache).
 */
export class Catalog {
  constructor(
    private db: Db,
    readonly live: LiveEvents | null = null,
    private images: Images | null = null,
  ) {}

  /** Attach a cached photo to a curated place (live events carry their own) */
  private withImage(p: Place): Place {
    if (!this.images || p.live) return p;
    const image = p.image ?? this.images.imageFor(p.id);
    const google = this.images.hoursFor(p.id);
    if (!image && !google) return p;
    return { ...p, ...(image ? { image } : {}), ...(google ? { openingHours: { schedule: google, approx: false } } : {}) };
  }

  get(id: string): Place | undefined {
    const p = PLACE_BY_ID[id] ?? this.live?.get(id) ?? this.db.data.livePlaces[id];
    return p && this.withImage(p);
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
    if (!live.length) return PLACES.map((p) => this.withImage(p));
    // A real show tonight beats our generic "see what's on at this venue" entry
    const exact = live.filter((l) => l.type === 'event' && !l.live?.approxLocation);
    const liveNames = live.map((l) => norm(l.name));
    const hidden = new Set(
      PLACES.filter(
        (p) =>
          p.type === 'event' &&
          (exact.some((l) => distanceKm([p.lat, p.lng], [l.lat, l.lng]) < 0.12) ||
            // the same thing by name ("Boston Ballet's The Nutcracker")
            liveNames.some((n) => n.length >= 8 && (n.includes(norm(p.name)) || norm(p.name).includes(n)))),
      ).map((p) => p.id),
    );
    return [...PLACES.filter((p) => !hidden.has(p.id)).map((p) => this.withImage(p)), ...live];
  }
}
