import { useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Chip, ChipSection } from '../components/Chip';
import { ArrowIcon, RefreshIcon } from '../components/Icons';
import { TopBar } from '../components/TopBar';
import { NEIGHBORHOOD_LINES, TYPE_COLORS } from '../config';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { Place } from '../lib/types';
import { bostonTime, dayName } from '../lib/util';

interface AgendaStop {
  place: Place;
  start: string;
  end: string;
  travel: { minutes: number; mode: 'walk' | 'T'; summary: string } | null;
}
interface AgendaDay {
  date: string;
  stops: AgendaStop[];
  route: { id: string; label: string }[];
}

type Span = 'day' | 'week';
type Pace = 'stay' | 'wander';

/** A random solo day or week out, with every stop a short hop from the last */
export default function Agenda() {
  const { meta, me } = useAuth();
  const navigate = useNavigate();
  const [span, setSpan] = useState<Span>('day');
  const [pace, setPace] = useState<Pace>('wander');
  const [start, setStart] = useState<string>('surprise');
  const [price, setPrice] = useState<string>(me?.user.lastPrice ?? '20to40');
  const [days, setDays] = useState<AgendaDay[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ days: AgendaDay[] }>('/agenda', {
        body: { span, pace, price, start: start === 'surprise' ? undefined : start },
      });
      setDays(r.days);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function addAll() {
    if (!days) return;
    setSaving(true);
    try {
      for (const d of days)
        for (const s of d.stops)
          await api('/plans', {
            body: {
              placeId: s.place.id,
              request: {
                location: s.place.neighborhood,
                type: s.place.type,
                price,
                startAt: s.start,
                durationMinutes: Math.max(15, Math.round((Date.parse(s.end) - Date.parse(s.start)) / 60_000)),
              },
            },
          });
      navigate('/history');
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  if (!meta) return null;
  const total = days?.reduce((a, d) => a + d.stops.length, 0) ?? 0;

  return (
    <div className="screen agenda">
      <TopBar back="/discover" />
      <p className="label">Solo · random</p>
      <h1 className="title">{days ? (span === 'week' ? 'Your week' : 'Your day') : 'Plan it for me'}</h1>

      {!days ? (
        <>
          <p className="lede">We'll string together stops that are a short walk apart. Stay in one neighborhood, or drift into the next one over.</p>
          <ChipSection title="How long">
            <Chip selected={span === 'day'} onClick={() => setSpan('day')}>
              A full day
            </Chip>
            <Chip selected={span === 'week'} onClick={() => setSpan('week')}>
              A week of evenings
            </Chip>
          </ChipSection>
          <ChipSection title="Route">
            <Chip selected={pace === 'wander'} onClick={() => setPace('wander')}>
              Wander
            </Chip>
            <Chip selected={pace === 'stay'} onClick={() => setPace('stay')}>
              Stay put
            </Chip>
          </ChipSection>
          <ChipSection title="Start in">
            <Chip selected={start === 'surprise'} onClick={() => setStart('surprise')}>
              Surprise me
            </Chip>
            {meta.neighborhoods.map((n) => (
              <Chip key={n.id} selected={start === n.id} lines={NEIGHBORHOOD_LINES[n.id]} onClick={() => setStart(n.id)}>
                {n.label.replace(' Boston', '')}
              </Chip>
            ))}
          </ChipSection>
          <ChipSection title="Budget per stop">
            {meta.priceTiers.map((t) => (
              <Chip key={t.id} selected={price === t.id} onClick={() => setPrice(t.id)}>
                {t.label}
              </Chip>
            ))}
          </ChipSection>
          {error && <p className="error">{error}</p>}
          <button type="button" className="btn btn--primary btn--block btn--lg" onClick={generate} disabled={busy}>
            {busy ? 'Planning…' : span === 'week' ? 'Plan my week' : 'Plan my day'} <ArrowIcon size={20} />
          </button>
        </>
      ) : (
        <>
          {total === 0 ? (
            <p className="lede">Nothing fit those choices. Try a bigger budget or another neighborhood.</p>
          ) : (
            days.map((d) => (
              <section key={d.date} className="agenda__day">
                <div className="agenda__day-head">
                  <h2 className="label">{dayName(new Date(`${d.date}T12:00:00-05:00`))}</h2>
                  <span className="small muted">{d.route.map((r) => r.label.replace(' Boston', '')).join(' → ')}</span>
                </div>
                {d.stops.length === 0 ? (
                  <p className="small muted">A night off.</p>
                ) : (
                  <ol className="day-line agenda__line">
                    {d.stops.map((s) => (
                      <li key={s.place.id} style={{ '--stop': TYPE_COLORS[s.place.type] } as CSSProperties}>
                        <span className="day-line__node" aria-hidden />
                        <div className="day-line__body">
                          {s.travel && <span className="agenda__travel tiny muted">{s.travel.summary}</span>}
                          <span className="small agenda__time">
                            {bostonTime(s.start)} – {bostonTime(s.end)}
                          </span>
                          <strong className="day-line__name">{s.place.name}</strong>
                          <span className="small muted">
                            {s.place.priceNote} · {meta.neighborhoods.find((n) => n.id === s.place.neighborhood)?.label ?? ''}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            ))
          )}
          {error && <p className="error">{error}</p>}
          <div className="agenda__actions">
            {total > 0 && (
              <button type="button" className="btn btn--primary btn--block btn--lg" onClick={addAll} disabled={saving}>
                {saving ? 'Adding…' : `Add ${total} stops to My line`} <ArrowIcon size={20} />
              </button>
            )}
            <button type="button" className="btn btn--ghost btn--block" onClick={generate} disabled={busy}>
              <RefreshIcon size={18} /> {busy ? 'Shuffling…' : 'Shuffle'}
            </button>
            <button type="button" className="btn btn--ghost btn--block" onClick={() => setDays(null)}>
              Change options
            </button>
          </div>
          <p className="small muted center">
            Hours are approximate for some places. <Link to="/discover">Or pick one stop at a time →</Link>
          </p>
        </>
      )}
    </div>
  );
}
