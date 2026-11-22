import type { CSSProperties } from 'react';
import { TYPE_COLORS } from '../config';
import { useAuth } from '../lib/auth';
import type { DayStop } from '../lib/types';
import { bostonTime } from '../lib/util';
import { Stars } from './Stars';

/** A day out drawn as a line: one station per stop, in the order you went */
export function DayLine({ stops, compact = false }: { stops: DayStop[]; compact?: boolean }) {
  const { meta } = useAuth();
  return (
    <ol className={`day-line${compact ? ' day-line--compact' : ''}`}>
      {stops.map((s, i) => (
        <li key={i} style={{ '--stop': TYPE_COLORS[s.place.type] } as CSSProperties}>
          <span className="day-line__node" aria-hidden />
          <div className="day-line__body">
            <strong className="day-line__name">{s.place.name}</strong>
            <span className="day-line__meta small muted">
              {bostonTime(s.at)} · {meta?.neighborhoods.find((n) => n.id === s.place.neighborhood)?.label ?? s.place.live?.area ?? 'Greater Boston'}
            </span>
            {s.rating > 0 && <Stars value={s.rating} size={compact ? 11 : 13} />}
          </div>
        </li>
      ))}
    </ol>
  );
}
