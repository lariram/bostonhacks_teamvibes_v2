import type { CSSProperties, ReactNode } from 'react';
import { LINES, type LineName } from '../config';

/** A colored line bullet, like the dots on a T map */
export function LineDot({ line, size = 10, title }: { line: LineName; size?: number; title?: string }) {
  return (
    <span
      className="line-dot"
      title={title ?? `${line[0].toUpperCase()}${line.slice(1)} Line`}
      style={{ width: size, height: size, background: LINES[line] }}
    />
  );
}

export function LineDots({ lines, size = 10 }: { lines: LineName[]; size?: number }) {
  if (!lines.length) return null;
  return (
    <span className="line-dots" aria-label={lines.map((l) => `${l} line`).join(', ')}>
      {lines.map((l) => (
        <LineDot key={l} line={l} size={size} />
      ))}
    </span>
  );
}

/**
 * The brand mark: one line comes in from the left to a station, splits in two,
 * and each branch splits again. Choose your own adventure, heading outbound.
 */
export function BrandMark({ width = 280, dark = false }: { width?: number | string; dark?: boolean }) {
  const node = dark ? '#0b0b0c' : '#fff';
  const ring = dark ? '#fff' : '#0b0b0c';
  return (
    <svg className="brand-mark" width={width} viewBox="0 0 320 140" aria-hidden>
      <g fill="none" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round">
        {/* the line in */}
        <path className="bm-1" d="M8 70 H84" stroke={ring} />
        {/* first choice */}
        <path className="bm-2" d="M84 70 L120 34 H170" stroke={LINES.red} />
        <path className="bm-2" d="M84 70 L120 106 H170" stroke={LINES.green} />
        {/* second choices */}
        <path className="bm-3" d="M170 34 L190 14 H312" stroke={LINES.red} />
        <path className="bm-3" d="M170 34 L190 54 H312" stroke={LINES.orange} />
        <path className="bm-3" d="M170 106 L190 86 H312" stroke={LINES.green} />
        <path className="bm-3" d="M170 106 L190 126 H312" stroke={LINES.blue} />
      </g>
      <circle className="bm-node" cx="170" cy="34" r="8" fill={node} stroke={ring} strokeWidth="5" />
      <circle className="bm-node" cx="170" cy="106" r="8" fill={node} stroke={ring} strokeWidth="5" />
      <circle cx="84" cy="70" r="15" fill={node} stroke={ring} strokeWidth="7" />
    </svg>
  );
}

/** Black station-sign block, like a T platform sign */
export function StationSign({ kicker, title, children, color }: { kicker?: ReactNode; title: ReactNode; children?: ReactNode; color?: string }) {
  return (
    <div className="station-sign" style={color ? ({ '--sign-accent': color } as CSSProperties) : undefined}>
      {kicker && <div className="station-sign__kicker">{kicker}</div>}
      <div className="station-sign__title">{title}</div>
      {children && <div className="station-sign__sub">{children}</div>}
    </div>
  );
}

/** A vertical line with stations, used for history, a group's day, and the generator */
export function LineTimeline<T>({
  items,
  color,
  render,
  isCurrent,
  className = '',
}: {
  items: T[];
  color: string;
  render: (item: T, i: number) => ReactNode;
  isCurrent?: (item: T) => boolean;
  className?: string;
}) {
  return (
    <ol className={`timeline ${className}`} style={{ '--line': color } as CSSProperties}>
      {items.map((item, i) => (
        <li key={i} className={`timeline__stop${isCurrent?.(item) ? ' is-current' : ''}`}>
          <span className="timeline__node" aria-hidden />
          <div className="timeline__body">{render(item, i)}</div>
        </li>
      ))}
    </ol>
  );
}

/** One track splitting into branches A and B (results header) */
export function Fork({ colorA, colorB }: { colorA: string; colorB: string }) {
  return (
    <svg className="fork" viewBox="0 0 320 64" aria-hidden>
      <g fill="none" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 32 H120" stroke="#0b0b0c" />
        <path d="M120 32 L148 12 H286" stroke={colorA} />
        <path d="M120 32 L148 52 H286" stroke={colorB} />
      </g>
      <circle cx="120" cy="32" r="8" fill="#fff" stroke="#0b0b0c" strokeWidth="4" />
      <g fontFamily="inherit" fontWeight="700" fontSize="13" textAnchor="middle">
        <circle cx="300" cy="12" r="11" fill={colorA} />
        <text x="300" y="16.5" fill="#fff">A</text>
        <circle cx="300" cy="52" r="11" fill={colorB} />
        <text x="300" y="56.5" fill="#fff">B</text>
      </g>
    </svg>
  );
}

/** Loading state: a train running down the line */
export function TrainLoader({ label = 'Finding your next stop' }: { label?: string }) {
  return (
    <div className="train-loader" role="status">
      <div className="train-loader__track">
        <span className="train-loader__train" />
      </div>
      <span className="small muted">{label}…</span>
    </div>
  );
}

/**
 * Schematic map of the 12 neighborhoods, drawn like a T map.
 * Visited neighborhoods light up. Geography is approximate on purpose.
 */
const NODES: Record<string, { x: number; y: number; label: string; anchor: 'start' | 'middle' | 'end'; dx: number; dy: number }> = {
  somerville: { x: 90, y: 40, label: 'Somerville', anchor: 'start', dx: 12, dy: -6 },
  cambridge: { x: 90, y: 88, label: 'Cambridge', anchor: 'end', dx: -12, dy: 4 },
  charlestown: { x: 240, y: 40, label: 'Charlestown', anchor: 'end', dx: -12, dy: 4 },
  northend: { x: 240, y: 100, label: 'North End', anchor: 'start', dx: 12, dy: 4 },
  downtown: { x: 220, y: 130, label: 'Downtown', anchor: 'end', dx: -30, dy: -10 },
  theater: { x: 175, y: 160, label: 'Theater', anchor: 'middle', dx: 0, dy: 18 },
  backbay: { x: 135, y: 160, label: 'Back Bay', anchor: 'middle', dx: 0, dy: -12 },
  fenway: { x: 95, y: 160, label: 'Fenway', anchor: 'middle', dx: 0, dy: 18 },
  allston: { x: 55, y: 160, label: 'Allston', anchor: 'middle', dx: 0, dy: -12 },
  brighton: { x: 25, y: 190, label: 'Brighton', anchor: 'start', dx: -6, dy: 20 },
  chinatown: { x: 240, y: 165, label: 'Chinatown', anchor: 'start', dx: 12, dy: 4 },
  seaport: { x: 285, y: 200, label: 'Seaport', anchor: 'middle', dx: 0, dy: 20 },
};

export function BostonMap({ visited }: { visited: Set<string> }) {
  return (
    <svg className="boston-map" viewBox="0 0 320 232" role="img" aria-label={`Map of Boston neighborhoods, ${visited.size} visited`}>
      <g fill="none" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9">
        <path d="M90 12 V100 L120 130 H225 V228" stroke={LINES.red} />
        <path d="M240 10 V185 H160 L135 160 L110 185 V228" stroke={LINES.orange} />
        <path d="M25 190 L55 160 H175 L205 130 H210 L240 100 L210 70 H120 L95 45" stroke={LINES.green} />
        <path d="M215 130 H305" stroke={LINES.blue} />
        <path d="M225 200 H285" stroke={LINES.silver} />
      </g>
      {/* Downtown is a big transfer station */}
      <rect x="196" y="122" width="52" height="16" rx="8" fill={visited.has('downtown') ? '#0b0b0c' : '#fff'} stroke="#0b0b0c" strokeWidth="3" />
      {Object.entries(NODES).map(([id, n]) => {
        const on = visited.has(id);
        return (
          <g key={id}>
            {id !== 'downtown' && <circle cx={n.x} cy={n.y} r={on ? 8 : 6} fill={on ? '#0b0b0c' : '#fff'} stroke="#0b0b0c" strokeWidth="3" />}
            <text
              x={n.x + n.dx}
              y={n.y + n.dy}
              textAnchor={n.anchor}
              className={`boston-map__label${on ? ' on' : ''}`}
            >
              {n.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
