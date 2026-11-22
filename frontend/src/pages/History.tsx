import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AddToCalendarSheet } from '../components/AddToCalendarSheet';
import { BackIcon, BookmarkIcon, LockIcon } from '../components/Icons';
import { TypeTag } from '../components/PlaceBadge';
import { Stars } from '../components/Stars';
import { PlacePhoto } from '../components/PlacePhoto';
import { LineDot } from '../components/Transit';
import { crewLine, TYPE_COLORS } from '../config';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { Place, Plan, SavedItem } from '../lib/types';
import { bostonTime, dayName, timeAgo } from '../lib/util';

const stopsLabel = (n: number) => (n === 0 ? 'No stops yet' : `${n} ${n === 1 ? 'stop' : 'stops'} so far`);
const when = (p: Plan) => new Date(p.startsAt ?? p.completedAt ?? p.createdAt);
const isUpcoming = (p: Plan) => p.status === 'active' && when(p).getTime() > Date.now() - 3 * 60 * 60 * 1000;
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
/** A saved listing with a real date/time (it can sit on the line and the calendar) */
const datedSaved = (s: SavedItem) => !s.planned && !!s.place.live && !s.place.live.openHours && !s.place.live.timeTBA;

type FutureItem = { kind: 'plan'; at: Date; plan: Plan } | { kind: 'saved'; at: Date; place: Place };

/** My line: your past stops, a "now" marker, and the line running on into your upcoming plans. */
export default function History() {
  const { me } = useAuth();
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'calendar' ? 'calendar' : 'line';
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [saved, setSaved] = useState<SavedItem[]>([]);
  const [calFor, setCalFor] = useState<Place | null>(null);

  const load = useCallback(() => {
    api<Plan[]>('/history').then(setPlans);
    api<SavedItem[]>('/saved').then(setSaved);
  }, []);
  useEffect(load, [load]);

  const upcoming = useMemo(() => (plans ?? []).filter(isUpcoming), [plans]);
  const past = useMemo(() => (plans ?? []).filter((p) => !isUpcoming(p)).sort((a, b) => when(a).getTime() - when(b).getTime()), [plans]);
  const future: FutureItem[] = useMemo(
    () =>
      [
        ...upcoming.map((plan) => ({ kind: 'plan' as const, at: when(plan), plan })),
        ...saved.filter(datedSaved).map((s) => ({ kind: 'saved' as const, at: new Date(s.place.live!.startsAt), place: s.place })),
      ].sort((a, b) => a.at.getTime() - b.at.getTime()),
    [upcoming, saved],
  );
  const anytime = saved.filter((s) => !s.planned && !datedSaved(s));
  const color = me?.user.avatarColor ?? '#0b0b0c';
  const empty = plans?.length === 0 && saved.length === 0;

  async function unsave(placeId: string) {
    await api(`/saved/${placeId}`, { method: 'POST' });
    load();
  }

  return (
    <div className="screen">
      <p className="label">{plans ? stopsLabel(plans.filter((p) => p.status === 'completed').length) : 'History'}</p>
      <h1 className="title">My line</h1>
      <div className="segmented my-line__switch" role="tablist">
        <button role="tab" aria-selected={view === 'line'} className={view === 'line' ? 'on' : ''} onClick={() => setParams({}, { replace: true })}>
          Line
        </button>
        <button
          role="tab"
          aria-selected={view === 'calendar'}
          className={view === 'calendar' ? 'on' : ''}
          onClick={() => setParams({ view: 'calendar' }, { replace: true })}
        >
          Calendar
        </button>
      </div>

      {!plans && <p className="muted center">Loading…</p>}
      {empty && (
        <div className="empty">
          <p>Your line is empty.</p>
          <Link to="/discover" className="btn btn--primary">
            Find your first stop
          </Link>
        </div>
      )}

      {plans && !empty && view === 'line' && (
        <TheLine past={past} future={future} color={color} onAddSaved={setCalFor} onUnsave={unsave} />
      )}
      {plans && !empty && view === 'calendar' && <CalendarView plans={plans} saved={saved.filter(datedSaved)} onAddSaved={setCalFor} />}

      {anytime.length > 0 && (
        <section className="saved-list">
          <h2 className="label section-label">
            <BookmarkIcon size={14} filled /> Saved for any time
          </h2>
          <ul>
            {anytime.map(({ place }) => (
              <li key={place.id}>
                <div>
                  <TypeTag type={place.type}>{place.live?.area ?? place.neighborhood}</TypeTag>
                  <strong>{place.name}</strong>
                </div>
                <div className="saved-list__actions">
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => setCalFor(place)}>
                    Add to my calendar
                  </button>
                  <button type="button" className="link tiny muted" onClick={() => unsave(place.id)}>
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {plans && !empty && <SyncCalendar />}

      <AddToCalendarSheet
        place={calFor}
        onClose={() => setCalFor(null)}
        onAdded={() => {
          setCalFor(null);
          load();
        }}
      />
    </div>
  );
}

/** One continuous line: earlier stops → now → what's coming up */
function TheLine({
  past,
  future,
  color,
  onAddSaved,
  onUnsave,
}: {
  past: Plan[];
  future: FutureItem[];
  color: string;
  onAddSaved: (p: Place) => void;
  onUnsave: (id: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const shownPast = showAll ? past : past.slice(-3);
  let lastDay = '';

  return (
    <ol className="myline" style={{ '--line': color } as CSSProperties}>
      {past.length > shownPast.length && (
        <li className="myline__more">
          <button type="button" className="link small muted" onClick={() => setShowAll(true)}>
            Show {past.length - shownPast.length} earlier {past.length - shownPast.length === 1 ? 'stop' : 'stops'}
          </button>
        </li>
      )}
      {shownPast.map((p) => (
        <li key={p.id} className="myline__stop is-past">
          <span className="myline__node" aria-hidden />
          <PlanStop plan={p} />
        </li>
      ))}

      <li className="myline__now">
        <span className="myline__node" aria-hidden />
        <span className="label">Now</span>
        <span className="small muted">{future.length ? `${future.length} coming up` : 'Nothing planned yet'}</span>
      </li>

      {future.map((item) => {
        const day = dayName(item.at);
        const header = day !== lastDay ? day : null;
        lastDay = day;
        return [
          header && (
            <li key={`h-${header}`} className="myline__day is-future">
              <span className="label">{header}</span>
            </li>
          ),
          item.kind === 'plan' ? (
            <li key={item.plan.id} className="myline__stop is-future">
              <span className="myline__node" aria-hidden />
              <PlanStop plan={item.plan} />
            </li>
          ) : (
            <li key={`s-${item.place.id}`} className="myline__stop is-future is-saved">
              <span className="myline__node" aria-hidden />
              <div className="stop-link">
                <span className="label label--muted">
                  <BookmarkIcon size={12} filled /> Saved · {bostonTime(item.place.live!.startsAt)}
                </span>
                <strong className="stop-link__name">{item.place.name}</strong>
                <span className="myline__saved-actions">
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => onAddSaved(item.place)}>
                    Add to my calendar
                  </button>
                  <button type="button" className="link tiny muted" onClick={() => onUnsave(item.place.id)}>
                    Remove
                  </button>
                </span>
              </div>
            </li>
          ),
        ];
      })}

      <li className="myline__tail is-future">
        <span className="myline__node" aria-hidden />
        <Link to="/discover" className="small">
          {future.length ? 'Add another stop →' : 'Find your next stop →'}
        </Link>
      </li>
    </ol>
  );
}

function PlanStop({ plan }: { plan: Plan }) {
  const d = when(plan);
  return (
    <Link to={`/plan/${plan.id}`} className="stop-link stop-link--photo">
      {plan.place.image && <PlacePhoto place={plan.place} variant="thumb" />}
      <TypeTag type={plan.place.type}>{plan.neighborhoodLabel}</TypeTag>
      <strong className="stop-link__name">{plan.place.name}</strong>
      <span className="small muted">
        {isUpcoming(plan) ? (
          <span className={sameDay(d, new Date()) ? 'live' : ''}>{bostonTime(d.toISOString())}</span>
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

/** Month grid: filled dots for plans, hollow dots for saved events; tap a day to see it */
function CalendarView({ plans, saved, onAddSaved }: { plans: Plan[]; saved: SavedItem[]; onAddSaved: (p: Place) => void }) {
  const today = new Date();
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<Date>(today);

  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [month]);
  const plansOn = (d: Date) => plans.filter((p) => sameDay(when(p), d)).sort((a, b) => when(a).getTime() - when(b).getTime());
  const savedOn = (d: Date) => saved.filter((s) => sameDay(new Date(s.place.live!.startsAt), d));
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const dayPlans = plansOn(selected);
  const daySaved = savedOn(selected);

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
          const ps = plansOn(d);
          const ss = savedOn(d);
          const cls = [
            'cal__day',
            d.getMonth() !== month.getMonth() ? 'is-other' : '',
            sameDay(d, today) ? 'is-today' : '',
            sameDay(d, selected) ? 'is-selected' : '',
          ].join(' ');
          return (
            <button key={d.toISOString()} type="button" className={cls} onClick={() => setSelected(d)} aria-label={`${d.toDateString()}, ${ps.length} plans, ${ss.length} saved`}>
              <span>{d.getDate()}</span>
              <span className="cal__dots">
                {ps.slice(0, 3).map((p) => (
                  <i key={p.id} style={{ background: TYPE_COLORS[p.place.type] }} />
                ))}
                {ss.slice(0, 3 - Math.min(ps.length, 3)).map((s) => (
                  <i key={s.place.id} className="hollow" style={{ borderColor: TYPE_COLORS[s.place.type] }} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <p className="tiny muted cal__legend">
        <i className="dot" /> planned <i className="dot hollow" /> saved from the feed
      </p>
      <h2 className="label section-label">{selected.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
      {dayPlans.length || daySaved.length ? (
        <ul className="cal__list">
          {dayPlans.map((p) => (
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
          {daySaved.map((s) => (
            <li key={s.place.id} className="is-saved">
              <div className="cal__saved">
                <span className="cal__time">{bostonTime(s.place.live!.startsAt)}</span>
                <span>
                  <strong>{s.place.name}</strong>
                  <span className="small muted block">Saved from the feed</span>
                </span>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => onAddSaved(s.place)}>
                  Add
                </button>
              </div>
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
      <h2 className="label">Also sync to another calendar (optional)</h2>
      {!path ? (
        <>
          <p className="small muted">Your plans already live here. If you want them in Apple or Google Calendar too, link it once.</p>
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
