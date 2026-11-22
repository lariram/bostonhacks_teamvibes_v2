import { StarIcon } from './Icons';

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="stars" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <StarIcon key={n} size={size} filled={n <= Math.round(value)} />
      ))}
    </span>
  );
}

const LABELS = ['', 'Not for me', 'Meh', 'Pretty good', 'Loved it', 'Wicked good'];

export function StarInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="star-input">
      <div className="star-input__row" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            className={`star-input__star${n <= value ? ' on' : ''}`}
            onClick={() => onChange(n)}
          >
            <StarIcon size={42} filled={n <= value} />
          </button>
        ))}
      </div>
      <p className="label star-input__label">{LABELS[value] || 'Tap to rate'}</p>
    </div>
  );
}
