import { PLACES } from '../data/places.js';
import type { Place } from '../types.js';

const norm = (s: string) => s.toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]/g, '');

/**
 * Listings without coordinates often name a venue we already know
 * ("Emerson Colonial Theatre"). Borrow its exact location and T stop.
 */
export function knownVenue(name: string | null | undefined): Place | undefined {
  const n = norm(name ?? '');
  if (n.length < 8) return undefined;
  return PLACES.find((p) => {
    const pn = norm(p.name);
    return pn.length >= 8 && (pn === n || pn.includes(n) || n.includes(pn));
  });
}
