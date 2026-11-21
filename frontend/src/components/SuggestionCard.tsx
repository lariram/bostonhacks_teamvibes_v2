import { useAuth } from '../lib/auth';
import type { Suggestion } from '../lib/types';
import { formatMinutes } from '../lib/util';
import { PlaceBadge, TypePill } from './PlaceBadge';
import { StarIcon } from './Icons';

interface Props {
  suggestion: Suggestion;
  onChoose: () => void;
  busy?: boolean;
  index: number;
}

export function SuggestionCard({ suggestion, onChoose, busy, index }: Props) {
  const { meta } = useAuth();
  const { place, reasons, stretchNote, communityRating } = suggestion;
  const hood = meta?.neighborhoods.find((n) => n.id === place.neighborhood)?.label ?? place.neighborhood;
  const price = meta?.priceTiers.find((t) => t.id === place.price)?.label ?? place.price;

  return (
    <article className="suggestion" style={{ animationDelay: `${index * 80}ms` }}>
      <div className="suggestion__top">
        <PlaceBadge place={place} />
        <div className="suggestion__titles">
          <TypePill type={place.type} />
          <h3>{place.name}</h3>
          <p className="muted">
            {hood} · {price} · ~{formatMinutes(place.minutes)}
          </p>
        </div>
      </div>
      <p className="suggestion__blurb">{place.blurb}</p>
      <ul className="reasons">
        {reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      {communityRating && communityRating.count > 0 && (
        <p className="community">
          <StarIcon size={14} filled /> {communityRating.avg.toFixed(1)} · {communityRating.count} rating
          {communityRating.count > 1 ? 's' : ''} from Bostonians
        </p>
      )}
      {stretchNote && <p className="stretch">Heads up: {stretchNote}</p>}
      <button type="button" className="btn btn--primary btn--block" onClick={onChoose} disabled={busy}>
        {busy ? 'One sec…' : 'Pick this one'}
      </button>
    </article>
  );
}
