import { useState, type CSSProperties } from 'react';
import { TYPE_COLORS } from '../config';
import type { Place } from '../lib/types';

/**
 * A real photo of the place or event, with its credit. If there's no photo (or
 * it won't load), a quiet type-colored tile with the place's emoji stands in,
 * so layouts never jump or break.
 */
export function PlacePhoto({ place, variant = 'card' }: { place: Place; variant?: 'card' | 'hero' | 'thumb' }) {
  const [failed, setFailed] = useState(false);
  const img = place.image && !failed ? place.image : null;
  // A big photo that won't load just disappears (no empty panel); thumbnails keep a tidy tile
  if (!img && variant !== 'thumb') return null;
  const style = { '--tint': TYPE_COLORS[place.type] } as CSSProperties;

  return (
    <figure className={`photo photo--${variant}${img ? '' : ' photo--empty'}`} style={style}>
      {img ? (
        <>
          <img src={img.url} alt={place.name} loading="lazy" decoding="async" onError={() => setFailed(true)} />
          {variant !== 'thumb' && (
            <figcaption>
              {img.creditUrl ? (
                <a href={img.creditUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                  {img.credit}
                </a>
              ) : (
                img.credit
              )}
            </figcaption>
          )}
        </>
      ) : (
        <span className="photo__emoji" aria-hidden>
          {place.emoji}
        </span>
      )}
    </figure>
  );
}
