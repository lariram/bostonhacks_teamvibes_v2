import { PLACES } from './data/places.js';
import { WIKI_TITLES } from './data/wikiTitles.js';
import type { Db } from './db.js';
import type { Place, PlaceImage } from './types.js';
import { scheduleFromGoogle, type Schedule } from './hours.js';

/**
 * Real photos for curated places (live events bring their own from the listing).
 *   1. Google Places photos, if GOOGLE_PLACES_API_KEY is set (best coverage,
 *      including restaurants). Photos are served through /api/photos/:id so the
 *      key never reaches the browser, and the photographer is credited.
 *   2. Otherwise Wikipedia / Wikimedia Commons: freely licensed photos only.
 * Results are cached in the database; nothing here ever blocks a request.
 */
const UA = 'common-boston/1.0 (student hackathon project)';
const REFRESH_MS = 30 * 24 * 60 * 60 * 1000; // re-check monthly (Google allows caching up to 30 days)

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export class Images {
  private googleUri = new Map<string, { uri: string; at: number }>();
  private backoffUntil = 0;

  constructor(
    private db: Db,
    private opts: { googleKey?: string; fetch?: Fetch; quiet?: boolean } = {},
  ) {
    db.data.imageCache ??= {};
  }

  private get cache() {
    return (this.db.data.imageCache ??= {});
  }
  private fetch(url: string, init?: RequestInit) {
    return (this.opts.fetch ?? fetch)(url, { ...init, headers: { 'User-Agent': UA, ...(init?.headers ?? {}) }, signal: AbortSignal.timeout(15_000) });
  }

  /** The cached photo for a place, if any */
  imageFor(id: string): PlaceImage | undefined {
    return this.cache[id]?.image ?? undefined;
  }

  /** Look up photos for any curated place we haven't checked lately. Background-safe. */
  async warm(): Promise<void> {
    if (Date.now() < this.backoffUntil) return;
    const due = PLACES.filter((p) => {
      const c = this.cache[p.id];
      return !c || Date.now() - Date.parse(c.fetchedAt) > REFRESH_MS;
    });
    if (!due.length) return;
    try {
      if (this.opts.googleKey) {
        for (const p of due) {
          await this.fromGoogle(p);
          await new Promise((r) => setTimeout(r, 120)); // stay well under rate limits
        }
      } else {
        await this.fromWikipedia(due);
      }
    } catch (err) {
      if (!this.opts.quiet) console.warn(`[images] ${(err as Error).message}`);
    }
    this.db.save();
    if (!this.opts.quiet) {
      const found = PLACES.filter((p) => this.cache[p.id]?.image).length;
      console.log(`[images] photos for ${found} of ${PLACES.length} curated places`);
    }
  }

  // ───────────── Wikipedia / Wikimedia Commons ─────────────
  private async fromWikipedia(places: Place[]) {
    const wanted = places.filter((p) => WIKI_TITLES[p.id]);
    for (const p of places) if (!WIKI_TITLES[p.id]) this.cache[p.id] = { image: null, fetchedAt: new Date().toISOString() };
    for (let i = 0; i < wanted.length; i += 50) {
      const batch = wanted.slice(i, i + 50);
      const titles = [...new Set(batch.map((p) => WIKI_TITLES[p.id]))];
      const params = new URLSearchParams({
        action: 'query',
        format: 'json',
        formatversion: '2',
        prop: 'pageimages',
        piprop: 'thumbnail|name',
        pithumbsize: '900',
        pilicense: 'free', // freely licensed images only (no logos / fair use)
        redirects: '1',
        titles: titles.join('|'),
      });
      const res = await this.fetch(`https://en.wikipedia.org/w/api.php?${params}`);
      if (res.status === 429) {
        this.backoffUntil = Date.now() + 60 * 60 * 1000;
        throw new Error('Wikipedia is rate-limiting us; will retry in an hour');
      }
      if (!res.ok) throw new Error(`Wikipedia HTTP ${res.status}`);
      this.applyWikipedia(batch, await res.json());
    }
  }

  /** Exposed for tests */
  applyWikipedia(batch: Place[], json: unknown) {
    const q = (json as { query?: WikiQuery }).query ?? {};
    // follow normalizations and redirects back to the title we asked for
    const resolve = (t: string) => {
      let title = t;
      for (const n of q.normalized ?? []) if (n.from === title) title = n.to;
      for (const r of q.redirects ?? []) if (r.from === title) title = r.to;
      return title;
    };
    const pages = new Map((q.pages ?? []).map((p) => [p.title, p]));
    for (const place of batch) {
      const page = pages.get(resolve(WIKI_TITLES[place.id]));
      const image: PlaceImage | null =
        page?.thumbnail?.source && page.pageimage
          ? {
              url: page.thumbnail.source,
              credit: 'Wikimedia Commons',
              creditUrl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(page.pageimage)}`,
              source: 'wikipedia',
            }
          : null;
      this.cache[place.id] = { image, fetchedAt: new Date().toISOString() };
    }
  }

  // ───────────── Google Places (Places API, New) ─────────────
  private async fromGoogle(p: Place) {
    const res = await this.fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.opts.googleKey!,
        'X-Goog-FieldMask': 'places.id,places.photos,places.regularOpeningHours',
      },
      body: JSON.stringify({
        textQuery: `${p.name}, ${p.address}`,
        maxResultCount: 1,
        locationBias: { circle: { center: { latitude: p.lat, longitude: p.lng }, radius: 400 } },
      }),
    });
    if (res.status === 429) {
      this.backoffUntil = Date.now() + 10 * 60 * 1000;
      throw new Error('Google Places rate limit; backing off');
    }
    if (!res.ok) throw new Error(`Google Places HTTP ${res.status}`); // the key never appears in errors
    this.applyGoogle(p, await res.json());
  }

  /** Exposed for tests */
  applyGoogle(p: Place, json: unknown) {
    const found = (json as GoogleSearch).places?.[0];
    const photo = found?.photos?.[0];
    const author = photo?.authorAttributions?.[0];
    const periods = found?.regularOpeningHours?.periods;
    this.cache[p.id] = {
      googlePhoto: photo?.name,
      image: photo?.name
        ? { url: `/api/photos/${p.id}`, credit: author?.displayName ? `Photo: ${author.displayName}` : 'Google', creditUrl: author?.uri, source: 'google' }
        : null,
      // Google's real opening hours replace our approximate ones
      hours: periods?.length ? scheduleFromGoogle(periods) : undefined,
      fetchedAt: new Date().toISOString(),
    };
  }

  /** Real opening hours from Google, if we have them */
  hoursFor(id: string): Schedule | undefined {
    return this.cache[id]?.hours;
  }

  /** A fresh Google photo URL for /api/photos/:id (short-lived, so cached ~1 hour in memory only) */
  async googlePhotoUrl(placeId: string): Promise<string | null> {
    const name = this.cache[placeId]?.googlePhoto;
    if (!name || !this.opts.googleKey) return null;
    const hit = this.googleUri.get(placeId);
    if (hit && Date.now() - hit.at < 50 * 60 * 1000) return hit.uri;
    const res = await this.fetch(`https://places.googleapis.com/v1/${name}/media?maxWidthPx=900&skipHttpRedirect=true`, {
      headers: { 'X-Goog-Api-Key': this.opts.googleKey },
    });
    if (!res.ok) return null;
    const uri = ((await res.json()) as { photoUri?: string }).photoUri;
    if (uri) this.googleUri.set(placeId, { uri, at: Date.now() });
    return uri ?? null;
  }
}

interface WikiQuery {
  normalized?: { from: string; to: string }[];
  redirects?: { from: string; to: string }[];
  pages?: { title: string; pageimage?: string; thumbnail?: { source: string } }[];
}
interface GoogleSearch {
  places?: {
    photos?: { name: string; authorAttributions?: { displayName?: string; uri?: string }[] }[];
    regularOpeningHours?: { periods?: { open?: { day: number; hour: number; minute?: number }; close?: { day: number; hour: number; minute?: number } }[] };
  }[];
}
