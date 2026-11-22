import { useEffect, useRef, useState } from 'react';
import { LINES, linesFromStop } from '../config';

/**
 * A minimal, on-brand map: OpenStreetMap tiles turned into a quiet light-gray
 * basemap, the place as a colored pin, its nearest T station in the
 * line's color, and a dotted walking path between them. Drawn from raw map
 * tiles, so there's no map library and no API key. If tiles can't load, the
 * pin, station and path still draw on a plain background.
 */
interface Props {
  lat: number;
  lng: number;
  color: string;
  station?: { name: string; lat: number; lng: number } | null;
  approx?: boolean;
  height?: number;
}

const TILE = 256;
const TILE_URL = (z: number, x: number, y: number) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;

/** Web Mercator: lat/lng → world pixel at zoom z */
function project(lat: number, lng: number, z: number): [number, number] {
  const scale = TILE * 2 ** z;
  const s = Math.sin((lat * Math.PI) / 180);
  return [((lng + 180) / 360) * scale, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale];
}

export function MapView({ lat, lng, color, station, approx, height = 210 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(360);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fit the place and its station: zoom out until both sit comfortably inside
  let z = approx ? 14 : 16;
  const pad = 46;
  if (station && !approx) {
    while (z > 13) {
      const [ax, ay] = project(lat, lng, z);
      const [bx, by] = project(station.lat, station.lng, z);
      if (Math.abs(ax - bx) < width - pad * 2 && Math.abs(ay - by) < height - pad * 2) break;
      z--;
    }
  }
  const [px, py] = project(lat, lng, z);
  const [sx, sy] = station ? project(station.lat, station.lng, z) : [px, py];
  // center between the two points
  const cx = station && !approx ? (px + sx) / 2 : px;
  const cy = station && !approx ? (py + sy) / 2 : py;
  const left = cx - width / 2;
  const top = cy - height / 2;

  const tiles: { x: number; y: number; key: string }[] = [];
  for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + width) / TILE); tx++) {
    for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + height) / TILE); ty++) {
      tiles.push({ x: tx, y: ty, key: `${z}/${tx}/${ty}` });
    }
  }

  const pin = { x: px - left, y: py - top };
  const st = { x: sx - left, y: sy - top };
  const stationColor = station ? LINES[linesFromStop(station.name)[0] ?? 'silver'] : LINES.silver;

  return (
    <div ref={ref} className="mapview" style={{ height }}>
      {tiles.map((t) => (
        <img
          key={t.key}
          className="mapview__tile"
          src={TILE_URL(z, t.x, t.y)}
          alt=""
          draggable={false}
          style={{ left: t.x * TILE - left, top: t.y * TILE - top }}
          onError={(e) => ((e.target as HTMLImageElement).style.visibility = 'hidden')}
        />
      ))}
      <svg className="mapview__overlay" width={width} height={height} aria-hidden>
        {station && !approx && (
          <>
            <line x1={st.x} y1={st.y} x2={pin.x} y2={pin.y} stroke="#0b0b0c" strokeWidth={2.5} strokeDasharray="1 7" strokeLinecap="round" />
            {/* the station: a square node in the line's color, so it never reads as the place */}
            <rect x={st.x - 8} y={st.y - 8} width={16} height={16} rx={4} fill="#fff" stroke={stationColor} strokeWidth={4.5} />
          </>
        )}
        {approx ? (
          <circle cx={pin.x} cy={pin.y} r={44} fill={color} fillOpacity={0.14} stroke={color} strokeOpacity={0.5} strokeDasharray="3 5" />
        ) : (
          <circle className="mapview__pulse" cx={pin.x} cy={pin.y} r={13} fill={color} fillOpacity={0.25} />
        )}
        <circle cx={pin.x} cy={pin.y + 1.5} r={13} fill="#0b0b0c" opacity={0.18} />
        <circle cx={pin.x} cy={pin.y} r={13} fill={color} stroke="#fff" strokeWidth={3} />
        <circle cx={pin.x} cy={pin.y} r={4} fill="#fff" />
      </svg>
      {station && !approx && (
        <span
          className="mapview__label"
          style={(() => {
            // put the label on the far side of the station from the pin
            const dx = st.x - pin.x;
            const dy = st.y - pin.y;
            const horizontal = Math.abs(dx) > Math.abs(dy);
            const x = horizontal ? st.x + Math.sign(dx || 1) * 58 : st.x;
            const y = horizontal ? st.y - 12 : st.y + (dy >= 0 ? 16 : -38);
            return { left: Math.min(Math.max(x, 60), width - 60), top: Math.min(Math.max(y, 6), height - 30) };
          })()}
        >
          <i style={{ background: stationColor }} /> {station.name.replace(/\s*\(.*\)/, '')}
        </span>
      )}
      <a className="mapview__attr" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
    </div>
  );
}
