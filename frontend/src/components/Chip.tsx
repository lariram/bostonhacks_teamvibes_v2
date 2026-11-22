import type { ReactNode } from 'react';
import type { LineName } from '../config';
import { LineDots } from './Transit';

interface ChipProps {
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
  /** T line bullets shown before the label */
  lines?: LineName[];
  title?: string;
}

export function Chip({ selected, disabled, onClick, children, lines, title }: ChipProps) {
  return (
    <button
      type="button"
      className={`chip${selected ? ' chip--on' : ''}`}
      aria-pressed={!!selected}
      disabled={disabled}
      onClick={onClick}
      title={title}
    >
      {lines && <LineDots lines={lines} size={8} />}
      {children}
    </button>
  );
}

/** Small-caps section label + chips */
export function ChipSection({ title, hint, children, aside }: { title: string; hint?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="chip-section">
      <div className="chip-section__head">
        <h2 className="label">{title}</h2>
        {hint && <span className="label label--muted">{hint}</span>}
        {aside}
      </div>
      <div className="chips">{children}</div>
    </section>
  );
}
