import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LINES } from '../config';
import type { TLine, TStopBingo } from '../lib/types';
import { LAYOUT, SHORT_LABEL, type Pt, type Side } from './tmapLayout';

const INK = '#0b0b0c';
const LINE_W = 13;
const STOP_R = 5.5;
const MAX_K = 2.4;
/** Zoom (screen px per map unit) at which every stop gets its name */
const LABEL_K = 0.42;
const MAP_H = 400;

// Light water, roughly where the Charles and the harbor are
const RIVER = 'M330,505 C430,470 520,520 600,560 S760,640 880,650 S1010,640 1060,612 S1160,520 1215,470 S1300,430 1345,452';
const HARBOR =
  'M1345,452 C1395,520 1340,620 1400,700 S1440,800 1360,830 L1340,900 C1420,920 1520,960 1700,960 L1900,960 L1900,560 C1810,600 1720,590 1640,560 S1480,440 1420,420 Z';

interface View {
  k: number;
  x: number;
  y: number;
}

const BOUNDS = (() => {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const s of LAYOUT.stops.values()) for (const [x, y] of s.pts) xs.push(x), ys.push(y);
  return { minX: Math.min(...xs) - 60, minY: Math.min(...ys) - 50, maxX: Math.max(...xs) + 60, maxY: Math.max(...ys) + 50 };
})();

function fitTo(w: number, h: number, b = BOUNDS): View {
  const k = Math.min(w / (b.maxX - b.minX), h / (b.maxY - b.minY));
  return { k, x: (w - (b.maxX - b.minX) * k) / 2 - b.minX * k, y: (h - (b.maxY - b.minY) * k) / 2 - b.minY * k };
}

/** Label placement in screen pixels, relative to the stop */
function labelProps(side: Side, r: number) {
  const g = r + 6;
  switch (side) {
    case 'l':
      return { x: -g, y: 4, anchor: 'end' as const };
    case 'r':
      return { x: g, y: 4, anchor: 'start' as const };
    case 't':
      return { x: 0, y: -g - 2, anchor: 'middle' as const };
    case 'b':
      return { x: 0, y: g + 10, anchor: 'middle' as const };
    case 'ur':
      return { x: g * 0.7, y: -g * 0.7, anchor: 'start' as const, rot: -45 };
    case 'dr':
      return { x: g * 0.7, y: g * 0.7 + 3, anchor: 'start' as const, rot: 45 };
    case 'dl':
      return { x: -g * 0.7, y: g * 0.7 + 3, anchor: 'end' as const, rot: -45 };
  }
}

/**
 * Every T stop on a schematic map, like the one on the platform wall.
 * Drag to move, pinch / scroll / buttons to zoom; names appear as you zoom in.
 */
export function TStopMap({ data }: { data: TStopBingo }) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 340, h: MAP_H });
  const [view, setView] = useState<View | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [focusLine, setFocusLine] = useState<TLine | null>(null);

  const info = useMemo(() => new Map(data.stops.map((s) => [s.name, s])), [data.stops]);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      setSize((s) => (s.w === w ? s : { w, h: MAP_H }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = useMemo(() => fitTo(size.w, size.h), [size]);
  useEffect(() => setView(null), [size.w]);
  const v = view ?? fit;
  const minK = fit.k * 0.9;

  const clampView = useCallback(
    (nv: View): View => {
      const k = Math.max(minK, Math.min(MAX_K, nv.k));
      // keep at least part of the network on screen
      const left = BOUNDS.minX * k + nv.x;
      const right = BOUNDS.maxX * k + nv.x;
      const top = BOUNDS.minY * k + nv.y;
      const bottom = BOUNDS.maxY * k + nv.y;
      let { x, y } = nv;
      const m = 80;
      if (right < m) x += m - right;
      if (left > size.w - m) x -= left - (size.w - m);
      if (bottom < m) y += m - bottom;
      if (top > size.h - m) y -= top - (size.h - m);
      return { k, x, y };
    },
    [minK, size],
  );

  const zoomAt = useCallback(
    (factor: number, cx: number, cy: number) =>
      setView((cur) => {
        const c = cur ?? fit;
        const k = Math.max(minK, Math.min(MAX_K, c.k * factor));
        const f = k / c.k;
        return clampView({ k, x: cx - (cx - c.x) * f, y: cy - (cy - c.y) * f });
      }),
    [fit, minK, clampView],
  );

  // Wheel zoom (needs a non-passive listener to keep the page from scrolling)
  useEffect(() => {
    const el = box.current?.querySelector('svg');
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0022)), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  // Drag + pinch with pointer events
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ moved: number; start: View; pinch?: { d: number; mx: number; my: number } } | null>(null);

  const local = (e: React.PointerEvent) => {
    const r = (e.currentTarget as SVGElement).getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const pinchOf = () => {
    const [a, b] = [...pointers.current.values()];
    return { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
  };

  const onDown = (e: React.PointerEvent) => {
    (e.currentTarget as SVGElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, local(e));
    gesture.current = { moved: gesture.current?.moved ?? 0, start: v, pinch: pointers.current.size === 2 ? pinchOf() : undefined };
    if (pointers.current.size === 1) gesture.current.moved = 0;
  };
  const onMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    const prev = pointers.current.get(e.pointerId);
    if (!g || !prev) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 2 && g.pinch) {
      const now = pinchOf();
      const k = Math.max(minK, Math.min(MAX_K, g.start.k * (now.d / g.pinch.d)));
      const f = k / g.start.k;
      g.moved += 10;
      setView(
        clampView({
          k,
          x: now.mx - (g.pinch.mx - g.start.x) * f,
          y: now.my - (g.pinch.my - g.start.y) * f,
        }),
      );
    } else if (pointers.current.size === 1) {
      const dx = p.x - prev.x;
      const dy = p.y - prev.y;
      g.moved += Math.abs(dx) + Math.abs(dy);
      setView((cur) => clampView({ ...(cur ?? fit), x: (cur ?? fit).x + dx, y: (cur ?? fit).y + dy }));
    }
  };
  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (pointers.current.size === 1) {
      // pinch → drag: restart from here
      gesture.current = { moved: g?.moved ?? 99, start: v };
      return;
    }
    if (pointers.current.size === 0) {
      if (g && g.moved < 6 && e.type === 'pointerup') {
        const hit = (document.elementFromPoint(e.clientX, e.clientY) as Element | null)?.closest('[data-stop]');
        const name = hit?.getAttribute('data-stop') ?? null;
        setPicked((cur) => (name && name !== cur ? name : null));
      }
      gesture.current = null;
    }
  };

  const showLine = (line: TLine) => {
    if (focusLine === line) {
      setFocusLine(null);
      setView(null);
      return;
    }
    setFocusLine(line);
    const pts: Pt[] = [];
    for (const s of data.stops) if (s.lines.includes(line)) pts.push(...(LAYOUT.stops.get(s.name)?.pts ?? []));
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const b = { minX: Math.min(...xs) - 70, maxX: Math.max(...xs) + 70, minY: Math.min(...ys) - 40, maxY: Math.max(...ys) + 40 };
    setView(clampView(fitTo(size.w, size.h, b)));
  };

  const showAllLabels = v.k >= LABEL_K;
  const sel = picked ? info.get(picked) : null;
  const selGeo = picked ? LAYOUT.stops.get(picked) : null;
  const dim = (line: TLine) => (focusLine && focusLine !== line ? 0.18 : 1);
  const order: TLine[] = ['silver', 'green', 'blue', 'orange', 'red'];

  const labels = useMemo(() => {
    type Box = [number, number, number, number];
    const kept: Box[] = [];
    const out: { name: string; text: string; on: boolean; anchor: 'start' | 'end' | 'middle'; transform: string }[] = [];
    const cands = [...LAYOUT.stops.values()]
      .map((s) => {
        const st = info.get(s.name);
        const on = !!st?.visited;
        const rank = s.name === picked ? 0 : on ? 1 : (st?.lines.length ?? 0) > 1 || s.pts.length > 1 ? 2 : 3;
        return { s, st, on, rank };
      })
      .filter(({ s, st, on }) => {
        if (!showAllLabels && !on && s.name !== picked) return false;
        if (focusLine && !st?.lines.includes(focusLine) && !on) return false;
        return true;
      })
      .sort((a, b) => a.rank - b.rank);
    // stop dots block labels too
    const dots: (Box & { owner?: string })[] = [];
    for (const s of LAYOUT.stops.values())
      for (const [x, y] of s.pts) {
        const sx = x * v.k + v.x;
        const sy = y * v.k + v.y;
        const r = Math.max(2.5, 6 * v.k);
        dots.push(Object.assign([sx - r, sy - r, sx + r, sy + r] as Box, { owner: s.name }));
      }
    const hits = (b: Box, list: Box[]) => list.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
    for (const { s, on } of cands) {
      const p = s.pts.length > 1 ? (s.side === 'l' ? s.pts.reduce((m, q) => (q[0] < m[0] ? q : m)) : s.pts.reduce((m, q) => (q[0] > m[0] ? q : m))) : s.pts[0];
      const sx = p[0] * v.k + v.x;
      const sy = p[1] * v.k + v.y;
      if (sx < -150 || sx > size.w + 150 || sy < -40 || sy > size.h + 40) continue;
      const text = SHORT_LABEL[s.name] ?? s.name;
      const lp = labelProps(s.side, Math.max(4, (on ? 9 : STOP_R) * v.k));
      const w = text.length * (on ? 7 : 6.2);
      const h = 12;
      const x0 = sx + lp.x;
      const y0 = sy + lp.y;
      const boxes: Box[] = [];
      if (lp.rot) {
        // a rotated label: a chain of small boxes along its diagonal
        const d = w * 0.7071;
        const dx = lp.anchor === 'end' ? -d : d;
        const dy = lp.rot < 0 ? (lp.anchor === 'end' ? d : -d) : d;
        const n = Math.max(2, Math.ceil(d / 7));
        for (let i = 0; i < n; i++) {
          const cx = x0 + (dx * (i + 0.5)) / n;
          const cy = y0 + (dy * (i + 0.5)) / n - 3;
          boxes.push([cx - 5, cy - 5, cx + 5, cy + 5]);
        }
      } else {
        const left = lp.anchor === 'end' ? x0 - w : lp.anchor === 'middle' ? x0 - w / 2 : x0;
        boxes.push([left, y0 - h + 2, left + w, y0 + 3]);
      }
      const others = dots.filter((dd) => dd.owner !== s.name);
      if (boxes.some((bx) => hits(bx, kept) || (!on && hits(bx, others)))) continue;
      kept.push(...boxes);
      out.push({
        name: s.name,
        text,
        on,
        anchor: lp.anchor,
        transform: `translate(${x0.toFixed(1)} ${y0.toFixed(1)})${lp.rot ? ` rotate(${lp.rot})` : ''}`,
      });
    }
    return out;
  }, [info, picked, showAllLabels, focusLine, v.k, v.x, v.y, size.w, size.h]);

  return (
    <div className="tmap">
      <div className="tmap__frame" ref={box} style={{ height: MAP_H }}>
        <svg
          className="tmap__svg"
          width={size.w}
          height={size.h}
          role="img"
          aria-label={`Map of every T stop, ${data.visited} of ${data.total} visited`}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onDoubleClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            zoomAt(2, e.clientX - r.left, e.clientY - r.top);
          }}
        >
          <g transform={`translate(${v.x} ${v.y}) scale(${v.k})`}>
            <path d={RIVER} fill="none" stroke="#dcebf5" strokeWidth="34" strokeLinecap="round" />
            <path d={HARBOR} fill="#dcebf5" />
            <g fill="none" strokeLinecap="round" strokeLinejoin="round">
              {order.flatMap((line) =>
                LAYOUT.routes
                  .filter((r) => r.line === line)
                  .map((r) => (
                    <polyline
                      key={r.key}
                      points={r.path.map((p) => p.join(',')).join(' ')}
                      stroke={LINES[r.line]}
                      strokeWidth={r.thin ? LINE_W * 0.6 : LINE_W}
                      opacity={dim(r.line)}
                    />
                  )),
              )}
            </g>
            {[...LAYOUT.stops.values()].map((s) => {
              const st = info.get(s.name);
              const on = !!st?.visited;
              const faded = focusLine && !st?.lines.includes(focusLine);
              const transfer = (st?.lines.length ?? 0) > 1 || s.pts.length > 1;
              const [a, b] = s.pts;
              return (
                <g key={s.name} data-stop={s.name} className="tmap__stop" opacity={faded ? 0.25 : 1}>
                  <circle cx={a[0]} cy={a[1]} r={16} fill="transparent" />
                  {b ? (
                    <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={INK} strokeWidth={STOP_R * 2 + 6} strokeLinecap="round" />
                  ) : null}
                  {s.pts.map((p, i) => (
                    <circle
                      key={i}
                      cx={p[0]}
                      cy={p[1]}
                      r={on ? Math.max(9, 4.5 / v.k) : transfer ? 7.5 : STOP_R}
                      fill={on ? INK : '#fff'}
                      stroke={INK}
                      strokeWidth={on ? 0 : transfer ? 3.5 : 2.6}
                    />
                  ))}
                  {b ? <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={on ? INK : '#fff'} strokeWidth={STOP_R * 2 - 1} strokeLinecap="round" /> : null}
                  {on && !b && <circle cx={a[0]} cy={a[1]} r={Math.max(3.4, 1.6 / v.k)} fill="#fff" />}
                </g>
              );
            })}
            {selGeo && (
              <circle
                cx={selGeo.pts[0][0]}
                cy={selGeo.pts[0][1]}
                r={18 / Math.sqrt(v.k)}
                fill="none"
                stroke={INK}
                strokeWidth={3 / Math.sqrt(v.k)}
                className="tmap__ring"
              />
            )}
          </g>
          {/* Labels in screen space so they stay readable at any zoom; overlapping ones are skipped */}
          <g className="tmap__labels">
            {labels.map((l) => (
              <text key={l.name} className={`tmap__label${l.on ? ' on' : ''}`} textAnchor={l.anchor} transform={l.transform}>
                {l.text}
              </text>
            ))}
          </g>
        </svg>
        <div className="tmap__zoom">
          <button type="button" aria-label="Zoom in" onClick={() => zoomAt(1.6, size.w / 2, size.h / 2)}>
            +
          </button>
          <button type="button" aria-label="Zoom out" onClick={() => zoomAt(1 / 1.6, size.w / 2, size.h / 2)}>
            −
          </button>
          <button
            type="button"
            aria-label="Show the whole map"
            className="tmap__fit"
            onClick={() => {
              setFocusLine(null);
              setView(null);
            }}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
              <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" fill="none" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </button>
        </div>
        {!showAllLabels && <p className="tmap__hint">Pinch or scroll to zoom · drag to move</p>}
      </div>

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
          <span className="muted">Tap a stop for its name, or a line below to zoom to it.</span>
        )}
      </p>
      <ul className="tmap__lines">
        {data.byLine.map((l) => (
          <li key={l.line}>
            <button type="button" className={focusLine === l.line ? 'on' : ''} onClick={() => showLine(l.line)} aria-pressed={focusLine === l.line}>
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
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
