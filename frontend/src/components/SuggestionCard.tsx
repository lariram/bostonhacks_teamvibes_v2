import { NEIGHBORHOOD_LINES, TYPE_COLORS, linesFromStop } from '../config';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import type { Suggestion } from '../lib/types';
import { bostonTime, formatMinutes, liveWhen } from '../lib/util';
import { ArrowIcon } from './Icons';
import { TypeTag } from './PlaceBadge';
import { PlacePhoto } from './PlacePhoto';
import { LineDots } from './Transit';

/** "Kendall/MIT (Red) · 4 min walk" → "Kendall/MIT · 4 min walk" */
function shortStop(stop: string): string {
  const name = stop.split(/[(,]| or |·/)[0].trim();
  const walk = stop.match(/(\d+) min walk/);
  return walk ? `${name} · ${walk[1]} min walk` : name;
}

interface Props {
  suggestion: Suggestion;
  letter: 'A' | 'B';
  onChoose: () => void;
  /** Save it to the in-app calendar without going yet */
  onAddToCalendar?: () => void;
  added?: boolean;
  busy?: boolean;
}

export function SuggestionCard({ suggestion, letter, onChoose, onAddToCalendar, added, busy }: Props) {
  const { meta } = useAuth();
  const { place, reasons, stretchNote, communityRating } = suggestion;
  const hood =
    place.neighborhood === 'greater'
      ? place.live?.area ?? 'Greater Boston'
      : meta?.neighborhoods.find((n) => n.id === place.neighborhood)?.label ?? place.neighborhood;
  const price = meta?.priceTiers.find((t) => t.id === place.price)?.label ?? place.price;
  const stopLines = linesFromStop(place.tStop);

  return (
    <article className="suggestion">
      <span className="suggestion__letter" style={{ background: TYPE_COLORS[place.type] }} aria-label={`Option ${letter}`}>
        {letter}
      </span>
      <div className="suggestion__body">
        {place.image && <PlacePhoto place={place} />}
        {place.live ? (
          <p className="live-kicker">
            <span className="live-dot" aria-hidden />
            {liveWhen(place.live)} <span className="live-kicker__src">· {hood}</span>
          </p>
        ) : (
          <TypeTag type={place.type}>{hood}</TypeTag>
        )}
        <h3 className="suggestion__name">{place.name}</h3>
        <p className="suggestion__meta">
          <span>{price}</span>
          {!place.live?.endEstimated && <span>~{formatMinutes(place.minutes)}</span>}
          <span className="suggestion__stop">
            <LineDots lines={stopLines.length ? stopLines : NEIGHBORHOOD_LINES[place.neighborhood] ?? []} size={8} />
            {shortStop(place.tStop)}
          </span>
          {place.live && <span className="muted">via {place.live.sourceName}</span>}
        </p>
        {(suggestion.travel || suggestion.openUntil) && (
          <p className="suggestion__getting">
            {suggestion.travel && <span>{suggestion.travel.mode === 'walk' ? '🚶' : '🚇'} {suggestion.travel.summary.replace(/ \(.*\)$/, '')}</span>}
            {suggestion.opensAt ? (
              <span>Opens {bostonTime(suggestion.opensAt)}</span>
            ) : suggestion.openUntil && !place.live ? (
              <span>
                Open till {bostonTime(suggestion.openUntil)}
                {suggestion.hoursApprox ? ' (approx.)' : ''}
              </span>
            ) : null}
          </p>
        )}
        <p className="suggestion__blurb">{place.blurb}</p>
        <ul className="reasons">
          {reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
          {communityRating && communityRating.count > 0 && (
            <li>
              ★ {communityRating.avg.toFixed(1)} from {communityRating.count} {communityRating.count === 1 ? 'local' : 'locals'}
            </li>
          )}
        </ul>
        {stretchNote && <p className="stretch">{stretchNote}</p>}
        <button type="button" className="btn btn--primary btn--block" onClick={onChoose} disabled={busy}>
          {busy ? 'Boarding…' : `Take ${letter}`} <ArrowIcon size={18} />
        </button>
        {onAddToCalendar &&
          (added ? (
            <Link to="/history?view=calendar" className="add-later added">
              ✓ On your calendar · View
            </Link>
          ) : (
            <button type="button" className="add-later" onClick={onAddToCalendar}>
              Add to my calendar for later
            </button>
          ))}
      </div>
    </article>
  );
}
