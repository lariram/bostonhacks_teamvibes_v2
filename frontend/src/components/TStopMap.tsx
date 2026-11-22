import { useMemo, useState } from 'react';
import { LINES } from '../config';
import type { TStopBingo } from '../lib/types';

// Downtown Crossing: the middle of the map
const C = { lat: 42.3555, lng: -71.0605 };
const KM_LAT = 111.2;
const KM_LNG = 111.2 * Math.cos((C.lat * Math.PI) / 180);
// Fish-eye: real geography, but the dense core gets room and the far ends fold in
const LENS_KM = 5;
const W = 320;
const PAD = 14;

function lens(lat: number, lng: number) {
  const x = (lng - C.lng) * KM_LNG;
  const y = -(lat - C.lat) * KM_LAT;
  const r = Math.hypot(x, y);
  const k = r === 0 ? 1 : 1 / (1 + r / LENS_KM);
  return { x: x * k, y: y * k };
}

/** Every rapid-transit stop, on a lens-distorted map; the ones you've been to fill in */
export function TStopMap({ data }: { data: TStopBingo }) {
  const [picked, setPicked] = useState<string | null>(null);

  const { pts, height, byName } = useMemo(() => {
    const raw = data.stops.map((s) => ({ ...s, ...lens(s.lat, s.lng) }));
    const xs = raw.map((p) => p.x);
    const ys = raw.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const scale = (W - PAD * 2) / (Math.max(...xs) - minX);
    const pts = raw.map((p) => ({ ...p, x: PAD + (p.x - minX) * scale, y: PAD + (p.y - minY) * scale }));
    const height = PAD * 2 + (Math.max(...ys) - minY) * scale;
    return { pts, height, byName: new Map(pts.map((p) => [p.name, p])) };
  }, [data.stops]);

  const sel = picked ? byName.get(picked) : null;

  return (
    <div className="tmap">
      <svg
        className="boston-map tmap__svg"
        viewBox={`0 0 ${W} ${height.toFixed(0)}`}
        role="img"
        aria-label={`Map of every T stop, ${data.visited} of ${data.total} visited`}
        onClick={() => setPicked(null)}
      >
        <g fill="none" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          {data.routes.map((r, i) => (
            <polyline
              key={i}
              stroke={LINES[r.line]}
              opacity={0.85}
              points={r.stops
                .map((n) => byName.get(n))
                .filter(Boolean)
                .map((p) => `${p!.x.toFixed(1)},${p!.y.toFixed(1)}`)
                .join(' ')}
            />
          ))}
        </g>
        {pts.map((p) => {
          const transfer = p.lines.length > 1;
          const on = p.visited;
          const r = on ? 4.2 : transfer ? 3 : 2.1;
          return (
            <g
              key={p.name}
              className="tmap__stop"
              onClick={(e) => {
                e.stopPropagation();
                setPicked(p.name === picked ? null : p.name);
              }}
            >
              {/* bigger invisible hit area for fingers */}
              <circle cx={p.x} cy={p.y} r={8} fill="transparent" />
              <circle
                cx={p.x}
                cy={p.y}
                r={r}
                fill={on ? '#0b0b0c' : '#fff'}
                stroke="#0b0b0c"
                strokeWidth={on ? 1.8 : transfer ? 1.6 : 1.1}
              />
              {p.name === picked && <circle cx={p.x} cy={p.y} r={r + 3.5} fill="none" stroke="#0b0b0c" strokeWidth="1.5" />}
            </g>
          );
        })}
        {pts
          .filter((p) => p.visited)
          .map((p) => (
            <text key={'l' + p.name} x={p.x + 6} y={p.y + 3} className="boston-map__label on tmap__label">
              {p.name}
            </text>
          ))}
      </svg>
      <p className="tmap__caption small" aria-live="polite">
        {sel ? (
          <>
            <span className="tmap__bullets">
              {sel.lines.map((l) => (
                <span key={l} style={{ background: LINES[l] }} />
              ))}
            </span>
            <strong>{sel.name}</strong>
            <span className="muted">{sel.visited ? ' · checked off' : ' · not yet'}</span>
          </>
        ) : (
          <span className="muted">Tap a stop to see its name.</span>
        )}
      </p>
      <ul className="tmap__lines">
        {data.byLine.map((l) => (
          <li key={l.line}>
            <span className="tmap__line-name">
              <span className="tmap__swatch" style={{ background: LINES[l.line] }} />
              {l.label}
            </span>
            <span className="tmap__bar">
              <span style={{ width: `${(l.visited / l.total) * 100}%`, background: LINES[l.line] }} />
            </span>
            <span className="tmap__count small">
              {l.visited}/{l.total}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
