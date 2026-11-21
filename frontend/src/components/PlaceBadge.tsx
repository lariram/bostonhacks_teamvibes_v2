import { TYPE_COLORS } from '../config';
import type { Place } from '../lib/types';

/** Colored emoji tile, colored by type (event = purple, activity = green, food = orange) */
export function PlaceBadge({ place, size = 56 }: { place: Place; size?: number }) {
  return (
    <span
      className="place-badge"
      style={{ width: size, height: size, fontSize: size * 0.5, background: `${TYPE_COLORS[place.type]}1f` }}
      aria-hidden
    >
      {place.emoji}
    </span>
  );
}

export function TypePill({ type }: { type: Place['type'] }) {
  return (
    <span className="type-pill" style={{ background: TYPE_COLORS[type] }}>
      {type}
    </span>
  );
}
