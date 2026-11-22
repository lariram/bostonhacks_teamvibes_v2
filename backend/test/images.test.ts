import { describe, expect, it } from 'vitest';
import { Catalog } from '../src/catalog.js';
import { PLACE_BY_ID } from '../src/data/places.js';
import { Db } from '../src/db.js';
import { Images } from '../src/images.js';
import { KNOWN_LOCALIST, normalizeLocalist } from '../src/live/sources/localist.js';
import { KNOWN_WP_EVENTS, normalizeWpEvents } from '../src/live/sources/wpEvents.js';

const ctx = { today: '2026-11-22', endDate: '2026-11-22', now: new Date('2026-11-22T12:00:00-05:00') };

describe('photos', () => {
  it('takes free Wikimedia photos, following Wikipedia redirects', () => {
    const db = new Db(null);
    const images = new Images(db, { quiet: true });
    images.applyWikipedia([PLACE_BY_ID['bunker-hill'], PLACE_BY_ID['old-state-house'], PLACE_BY_ID['swan-boats']], {
      query: {
        redirects: [{ from: 'Swan Boats', to: 'Swan Boats (Boston)' }],
        pages: [
          { title: 'Bunker Hill Monument', pageimage: 'Bunker_Hill_Monument.jpg', thumbnail: { source: 'https://upload.wikimedia.org/a/bhm.jpg' } },
          { title: 'Old State House (Boston)' }, // no free image
          { title: 'Swan Boats (Boston)', pageimage: 'Swan.jpg', thumbnail: { source: 'https://upload.wikimedia.org/a/swan.jpg' } },
        ],
      },
    });
    expect(images.imageFor('bunker-hill')).toMatchObject({ url: 'https://upload.wikimedia.org/a/bhm.jpg', source: 'wikipedia' });
    expect(images.imageFor('bunker-hill')!.creditUrl).toContain('commons.wikimedia.org/wiki/File:');
    expect(images.imageFor('old-state-house')).toBeUndefined();
    expect(images.imageFor('swan-boats')!.url).toContain('swan.jpg');

    // the catalog hands places out with their photo attached
    const catalog = new Catalog(db, null, images);
    expect(catalog.get('bunker-hill')!.image!.url).toContain('bhm.jpg');
    expect(catalog.candidates(ctx.now).find((p) => p.id === 'bunker-hill')!.image).toBeTruthy();
  });

  it('proxies Google Places photos (key never in the URL) and credits the photographer', () => {
    const images = new Images(new Db(null), { googleKey: 'secret-key', quiet: true });
    images.applyGoogle(PLACE_BY_ID.regina, {
      places: [{ photos: [{ name: 'places/abc/photos/xyz', authorAttributions: [{ displayName: 'Jane Doe', uri: 'https://maps.google.com/jane' }] }] }],
    });
    const img = images.imageFor('regina')!;
    expect(img).toMatchObject({ url: '/api/photos/regina', credit: 'Photo: Jane Doe', source: 'google' });
    expect(JSON.stringify(img)).not.toContain('secret-key');
  });

  it('keeps the photo that comes with a live listing', () => {
    const [campus] = normalizeLocalist(
      {
        events: [
          {
            event: {
              id: 1,
              title: 'Jazz night',
              experience: 'inperson',
              status: 'live',
              location_name: 'Kresge',
              geo: {},
              photo_url: 'https://localist-images.azureedge.net/photos/1/huge/x.jpg',
              filters: { event_types: [{ name: 'Music' }] },
              event_instances: [{ event_instance: { id: 1, start: '2026-11-22T19:00:00-05:00', end: '2026-11-22T21:00:00-05:00' } }],
            },
          },
        ],
      },
      KNOWN_LOCALIST[0],
      ctx,
    );
    expect(campus.image).toMatchObject({ url: expect.stringContaining('localist-images'), credit: 'MIT Events', source: 'event' });

    const [show] = normalizeWpEvents(
      {
        events: [
          {
            id: 9,
            title: 'Holiday Stroll',
            status: 'publish',
            start_date: '2026-11-22 18:00:00',
            end_date: '2026-11-22 20:00:00',
            image: { url: 'https://www.downtownboston.org/big.jpg', sizes: { medium_large: { url: 'https://www.downtownboston.org/ml.jpg' } } },
            venue: { venue: 'Somewhere', city: 'Boston', zip: '02108' },
          },
        ],
      },
      KNOWN_WP_EVENTS[0],
      ctx,
    );
    expect(show.image!.url).toBe('https://www.downtownboston.org/ml.jpg'); // a right-sized version, not the 2048px original
  });
});
