import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BackIcon, LockIcon } from '../components/Icons';
import { TypeTag } from '../components/PlaceBadge';
import { Stars } from '../components/Stars';
import { LineDot, LineTimeline } from '../components/Transit';
import { crewLine, TYPE_COLORS } from '../config';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { Plan } from '../lib/types';
import { bostonTime, dayName, timeAgo } from '../lib/util';

const stopsLabel = (n: number) => (n === 0 ? 'No stops yet' : `${n} ${n === 1 ? 'stop' : 'stops'} so far`);
const when = (p: Plan) => new Date(p.startsAt ?? p.completedAt ?? p.createdAt);
const isUpcoming = (p: Plan) => p.status === 'active' && when(p).getTime() > Date.now() - 3 * 60 * 60 * 1000;
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** History, drawn as your own line (every place you've been is a stop), plus a calendar view. */
export default function History() {
  const { me } = useAuth();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [view, setView] = useState<'line' | 'calendar'>('line');
  useEffect(() => {
    api<Plan[]>('/history').then(setPlans);
  }, []);

  const upcoming = useMemo(() => (plans ?? []).filter(isUpcoming).sort((a, b) => when(a).getTime() - when(b).getTime()), [plans]);
  const past = useMemo(() => (plans ?? []).filter((p) => !isUpcoming(p)).sort((a, b) => when(b).getTime() - when(a).getTime()), [plans]);
  const color = me?.user.avatarColor ?? '#0b0b0c';

  return (
    <div className="screen">
      <p className="label">{plans ? stopsLabel(plans.filter((p) => p.status === 'completed').length) : 'History'}</p>
      <h1 className="title">My line</h1>
      <div className="segmented my-line__switch" role="tablist">
        <button role="tab" aria-selected={view === 'line'} className={view === 'line' ? 'on' : ''} onClick={() => setView('line')}>
          Line
        </button>
        <button role="tab" aria-selected={view === 'calendar'} className={view === 'calendar' ? 'on' : ''} onClick={() => setView('calendar')}>
          Calendar
        </button>
      </div>

      {!plans && <p className="muted center">Loading…</p>}
      {plans?.length === 0 && (
        <div className="empty">
          <p>Your line is empty.</p>
          <Link to="/discover" className="btn btn--primary">
            Find your first stop
          </Link>
        </div>
      )}

      {plans && plans.length > 0 && view === 'line' && (
        <>
          {upcoming.length > 0 && (
            <>
              <h2 className="label section-label">Coming up</h2>
              <LineTimeline items={upcoming} color={color} isCurrent={(p) => p === upcoming[0]} render={(p) => <PlanStop plan={p} />} />
            </>
          )}
          {past.length > 0 && (
            <>
              <h2 className="label section-label">Been there</h2>
              <p className="small muted">Notes here are private.</p>
              <LineTimeline items={past} color={color} render={(p) => <PlanStop plan={p} />} />
            </>
          )}
        </>
      )}

      {plans && plans.length > 0 && view === 'calendar' && <CalendarView plans={plans} />}

      {plans && plans.length > 0 && <SyncCalendar />}
    </div>
  );
}

function PlanStop({ plan }: { plan: Plan }) {
  const d = when(plan);
  return (
    <Link to={`/plan/${plan.id}`} className="stop-link">
      <TypeTag type={plan.place.type}>{plan.neighborhoodLabel}</TypeTag>
      <strong className="stop-link__name">{plan.place.name}</strong>
      <span className="small muted">
        {isUpcoming(plan) ? (
          <span className={sameDay(d, new Date()) ? 'live' : ''}>
            {dayName(d)} · {bostonTime(d.toISOString())}
          </span>
        ) : (
          timeAgo(plan.completedAt ?? plan.startsAt ?? plan.createdAt)
        )}
        {plan.group && (
          <>
            {' · '}
            <LineDot line={crewLine(plan.group.id)} size={7} /> {plan.group.name}
          </>
        )}
      </span>
      {plan.rating ? <Stars value={plan.rating} size={13} /> : null}
      {plan.review && (
        <span className="stop-link__review small">
          <LockIcon size={11} /> {plan.review}
        </span>
      )}
    </Link>
  );
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Month grid: dots for each plan (colored by type), tap a day to see what's on it */
function CalendarView({ plans }: { plans: Plan[] }) {
  const today = new Date();
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<Date>(today);

  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [month]);
  const onDay = (d: Date) => plans.filter((p) => sameDay(when(p), d)).sort((a, b) => when(a).getTime() - when(b).getTime());
  const selectedPlans = onDay(selected);
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));

  return (
    <section className="cal">
      <div className="cal__head">
        <button type="button" className="icon-btn" aria-label="Previous month" onClick={() => shift(-1)}>
          <BackIcon size={20} />
        </button>
        <strong>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</strong>
        <button type="button" className="icon-btn cal__next" aria-label="Next month" onClick={() => shift(1)}>
          <BackIcon size={20} />
        </button>
      </div>
      <div className="cal__grid" role="grid">
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="cal__wd">
            {w}
          </span>
        ))}
        {cells.map((d) => {
          const items = onDay(d);
          const cls = [
            'cal__day',
            d.getMonth() !== month.getMonth() ? 'is-other' : '',
            sameDay(d, today) ? 'is-today' : '',
            sameDay(d, selected) ? 'is-selected' : '',
          ].join(' ');
          return (
            <button key={d.toISOString()} type="button" className={cls} onClick={() => setSelected(d)} aria-label={`${d.toDateString()}, ${items.length} plans`}>
              <span>{d.getDate()}</span>
              <span className="cal__dots">
                {items.slice(0, 3).map((p) => (
                  <i key={p.id} style={{ background: TYPE_COLORS[p.place.type] }} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <h2 className="label section-label">{selected.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
      {selectedPlans.length ? (
        <ul className="cal__list">
          {selectedPlans.map((p) => (
            <li key={p.id}>
              <Link to={`/plan/${p.id}`}>
                <span className="cal__time">{bostonTime(when(p).toISOString())}</span>
                <span>
                  <strong>{p.place.name}</strong>
                  <span className="small muted block">{p.neighborhoodLabel}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="small muted">
          Nothing planned. <Link to="/discover">Find something</Link>
        </p>
      )}
    </section>
  );
}

/** Subscribe your calendar app to My line, so new plans show up on their own */
function SyncCalendar() {
  const [path, setPath] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const load = async () => setPath((await api<{ path: string }>('/me/calendar')).path);
  const https = path ? `${window.location.origin}${path}` : '';

  return (
    <section className="sync">
      <h2 className="label">Sync with your calendar</h2>
      {!path ? (
        <>
          <p className="small muted">Every plan you make shows up in Apple or Google Calendar automatically.</p>
          <button type="button" className="btn btn--ghost btn--sm" onClick={load}>
            Get my calendar link
          </button>
        </>
      ) : (
        <>
          <div className="add-cal__buttons">
            <a className="btn btn--primary btn--sm" href={https.replace(/^https?:/, 'webcal:')}>
              Subscribe in Apple Calendar
            </a>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={async () => {
                await navigator.clipboard?.writeText(https);
                setCopied(true);
              }}
            >
              {copied ? 'Copied' : 'Copy link for Google'}
            </button>
          </div>
          <p className="tiny muted">
            Google Calendar: Settings → Add calendar → From URL, then paste. Keep this link private. Calendar apps can only reach it while
            the app is running somewhere they can see (on your computer for Apple Calendar; a public server for Google).
          </p>
        </>
      )}
    </section>
  );
}
