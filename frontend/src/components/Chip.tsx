import type { CSSProperties, ReactNode } from 'react';

interface ChipProps {
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
  /** Override the selected fill color */
  color?: string;
  title?: string;
}

export function Chip({ selected, disabled, onClick, children, color, title }: ChipProps) {
  const style = selected && color ? ({ '--chip-on': color } as CSSProperties) : undefined;
  return (
    <button
      type="button"
      className={`chip${selected ? ' chip--on' : ''}`}
      aria-pressed={!!selected}
      disabled={disabled}
      onClick={onClick}
      style={style}
      title={title}
    >
      {children}
    </button>
  );
}

interface SectionProps {
  title: string;
  hint?: string;
  children: ReactNode;
  aside?: ReactNode;
}

/** A titled block of chips, like the wireframe's "Location / Select one" */
export function ChipSection({ title, hint, children, aside }: SectionProps) {
  return (
    <section className="chip-section">
      <div className="chip-section__head">
        <div>
          <h2 className="subhead">{title}</h2>
          {hint && <p className="hint">{hint}</p>}
        </div>
        {aside}
      </div>
      <div className="chips">{children}</div>
    </section>
  );
}
