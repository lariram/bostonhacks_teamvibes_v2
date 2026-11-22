import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AvatarStack } from '../components/Avatar';
import { Chip } from '../components/Chip';
import { ArrowIcon } from '../components/Icons';
import { crewLine, LINES, NEIGHBORHOOD_LINES, TYPE_COLORS, TYPE_LINE } from '../config';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useRecSession } from '../lib/session';
import type { Group, LiveStatus, PlaceType, PriceTier, RecRequest } from '../lib/types';
import { clock, currentLocation, dayName, durationLabel, startSlots, upcomingDays, windowLabel } from '../lib/util';

/** 'now' or an ISO start time */
type When = 'now' | string;

const joinNames = (names: string[]) => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

/** One stop on the route. The line fills in as you answer. */
function Stop({ label, value, done, children }: { label: string; value?: string; done: boolean; children: ReactNode }) {
  return (
    <li className={`route__stop${done ? ' is-done' : ''}`}>
      <span className="route__node" aria-hidden />
      <div className="route__head">
        <h2 className="label">{label}</h2>
        {value && <span className="route__value">{value}</span>}
      </div>
      <div className="chips">{children}</div>
    </li>
  );
}

/** "Generate Recommendations": four quick stops, then go */
export default function Discover() {
  const { meta, me } = useAuth();
  const session = useRecSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const groupId = params.get('group');
  const [group, setGroup] = useState<Group | null>(null);

  // Start from the last request so "another one" is one tap away
  const last = session.request;
  const [location, setLocation] = useState<string | null>(last?.location ?? null);
  const [type, setType] = useState<PlaceType | null>(last?.type ?? null);
  const [price, setPrice] = useState<PriceTier | null>(last?.price ?? me?.user.lastPrice ?? null);
  const [duration, setDuration] = useState<number | null>(last?.durationMinutes ?? null);
  const [when, setWhen] = useState<When>('now');
  const days = useMemo(() => upcomingDays(14), []);
  const [dayIdx, setDayIdx] = useState(0);
  const slots = useMemo(() => startSlots(days[dayIdx]), [days, dayIdx]);
  const pickDay = (i: number) => {
    setDayIdx(i);
    // "Now" only makes sense today; other days start at a real time (default 7 PM, or the first slot)
    if (i === 0) setWhen('now');
    else {
      const all = startSlots(days[i]);
      setWhen((all.find((t) => t.getHours() === 19) ?? all[0]).toISOString());
    }
  };
  const [widen, setWiden] = useState<boolean>(last?.widen ?? false);

  // Keep the chosen day and time visible in their swipeable rows
  const dayRow = useRef<HTMLDivElement>(null);
  const timeRow = useRef<HTMLDivElement>(null);
  useEffect(() => {
    for (const row of [dayRow.current, timeRow.current]) {
      const chip = row?.querySelector<HTMLElement>('.chip--on');
      if (row && chip) row.scrollTo({ left: chip.offsetLeft - row.clientWidth / 2 + chip.clientWidth / 2, behavior: 'smooth' });
    }
  }, [when, dayIdx]);
  const [groupMode, setGroupMode] = useState<boolean>(last?.groupMode ?? false);

  // How many real events are on today (shown as a live indicator)
  const [live, setLive] = useState<LiveStatus | null>(null);
  useEffect(() => {
    api<LiveStatus>('/live').then(setLive).catch(() => setLive(null));
  }, []);

  useEffect(() => {
    if (!groupId) return setGroup(null);
    api<Group>(`/groups/${groupId}`).then(setGroup).catch(() => setGroup(null));
  }, [groupId]);

  const tierRank = (t: PriceTier) => meta?.priceTiers.findIndex((p) => p.id === t) ?? 0;
  const groupBudgetRank = group ? tierRank(group.budget) : Infinity;

  // Default to the crew's budget, and never sit above it
  useEffect(() => {
    if (group && (!price || tierRank(price) > groupBudgetRank)) setPrice(group.budget);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group]);

  const ready = location && type && price && duration;
  const left = [location, type, price, duration].filter((x) => !x).length;

  async function go() {
    if (!ready) return;
    // Travel times are measured from where you are (if you allow it), else from the area you picked
    const from = await currentLocation();
    const req: RecRequest = {
      location,
      type,
      price,
      durationMinutes: duration,
      startAt: when === 'now' ? new Date().toISOString() : when,
      groupMode: group ? false : groupMode,
      widen: location !== 'anywhere' && widen,
      from,
      groupId: group?.id,
    };
    if (await session.generate(req)) navigate('/discover/results');
  }

  if (!meta) return <div className="screen center muted">Loading…</div>;
  const label = (list: { id: string; label: string }[], id: string | null) => list.find((x) => x.id === id)?.label;
  const lineColor = type ? TYPE_COLORS[type] : LINES.silver;
  const crewColor = group ? LINES[crewLine(group.id)] : undefined;

  return (
    <div className="screen with-footer">
      {group ? (
        <div className="crew-banner" style={{ '--crew': crewColor } as CSSProperties}>
          <AvatarStack users={group.members} size={28} />
          <div>
            <p className="label">Planning for {group.name}</p>
            <p className="small muted">
              Only picks that work for all {group.members.length}.{' '}
              <Link to="/discover" replace>
                Ride solo
              </Link>
            </p>
          </div>
        </div>
      ) : (
        <p className="label">{me?.user.persona === 'visitor' ? 'Welcome to Boston' : `Hi, ${me?.user.firstName}`}</p>
      )}
      <h1 className="title">{group ? 'Where to next?' : 'Where to?'}</h1>
      <p className="lede">Four quick stops. We'll do the deciding.</p>
      {live?.enabled && live.total > 0 && (
        <p className="live-banner">
          <span className="live-dot" aria-hidden />
          <span>
            {live.today ? (
              <>
                <strong>{live.today}</strong> {live.today === 1 ? 'event' : 'events'} on today · {live.total} in the next two weeks
              </>
            ) : (
              <>
                <strong>{live.total}</strong> events in the next two weeks
              </>
            )}
          </span>
          <span className="live-banner__src muted">From {joinNames(live.sources.filter((x) => x.count > 0).map((x) => x.name))}</span>
        </p>
      )}

      <ol className="route" style={{ '--line': lineColor } as CSSProperties}>
        <Stop label="Where" value={location === 'anywhere' ? 'Anywhere' : label(meta.neighborhoods, location)} done={!!location}>
          {meta.neighborhoods.map((n) => (
            <Chip key={n.id} selected={location === n.id} lines={NEIGHBORHOOD_LINES[n.id]} onClick={() => setLocation(n.id)}>
              {n.label.replace(' Boston', '')}
            </Chip>
          ))}
          <Chip selected={location === 'anywhere'} onClick={() => setLocation('anywhere')}>
            Surprise me
          </Chip>
          {location !== 'anywhere' && (
            <label className="switch widen">
              <input type="checkbox" checked={widen} onChange={(e) => setWiden(e.target.checked)} />
              <span className="switch__track" />
              <span className="small">
                <strong>Nothing here? Look anywhere on the T.</strong>
                <span className="muted block">Subway, Green Line, Silver Line. No Commuter Rail. Off by default.</span>
              </span>
            </label>
          )}
        </Stop>

        <Stop label="What" value={label(meta.types, type)} done={!!type}>
          {meta.types.map((t) => (
            <Chip key={t.id} selected={type === t.id} lines={[TYPE_LINE[t.id]]} onClick={() => setType(t.id)}>
              {t.label}
            </Chip>
          ))}
        </Stop>

        <Stop
          label="Budget"
          value={group ? `Crew max ${meta.priceTiers[groupBudgetRank]?.label}` : label(meta.priceTiers, price)}
          done={!!price}
        >
          {meta.priceTiers.map((t, i) => (
            <Chip
              key={t.id}
              selected={price === t.id}
              disabled={i > groupBudgetRank}
              onClick={() => setPrice(t.id)}
              title={i > groupBudgetRank ? "Over someone in the crew's budget" : undefined}
            >
              {t.label}
            </Chip>
          ))}
        </Stop>

        <Stop
          label="When"
          value={
            duration
              ? `${dayName(when === 'now' ? new Date() : new Date(when))} · ${windowLabel(when === 'now' ? new Date() : new Date(when), duration)}`
              : undefined
          }
          done={!!duration}
        >
          <p className="hint full">Day</p>
          <div className="time-scroller" role="radiogroup" aria-label="Day" ref={dayRow}>
            {days.map((d, i) => (
              <Chip key={d.toDateString()} selected={dayIdx === i} onClick={() => pickDay(i)}>
                {i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              </Chip>
            ))}
          </div>
          <p className="hint full">Starting</p>
          <div className="time-scroller" role="radiogroup" aria-label="Start time" ref={timeRow}>
            {dayIdx === 0 && (
              <Chip selected={when === 'now'} onClick={() => setWhen('now')}>
                Now
              </Chip>
            )}
            {slots.map((t) => (
              <Chip key={t.toISOString()} selected={when === t.toISOString()} onClick={() => setWhen(t.toISOString())}>
                {clock(t)}
              </Chip>
            ))}
          </div>
          <p className="hint full">For</p>
          {(meta.durationOptions ?? [30, 60, 90, 120, 180, 240, 360]).map((m) => (
            <Chip key={m} selected={duration === m} onClick={() => setDuration(m)}>
              {durationLabel(m)}
            </Chip>
          ))}
        </Stop>

        {!group && (
          <li className="route__stop is-done route__stop--last">
            <span className="route__node" aria-hidden />
            <div className="route__head">
              <h2 className="label">Who</h2>
            </div>
            <div className="segmented" role="radiogroup" aria-label="Who's coming">
              <button type="button" role="radio" aria-checked={!groupMode} className={!groupMode ? 'on' : ''} onClick={() => setGroupMode(false)}>
                Just me
              </button>
              <button type="button" role="radio" aria-checked={groupMode} className={groupMode ? 'on' : ''} onClick={() => setGroupMode(true)}>
                Find me a crew
              </button>
            </div>
            <p className="small muted route__hint">
              {groupMode
                ? "We'll match you with Bostonians headed to the same spot. Click with them? Keep the crew for the rest of the day."
                : 'Want company? Find a crew and meet people who are into the same things.'}
            </p>
          </li>
        )}
      </ol>

      {session.error && <p className="error">{session.error}</p>}

      <footer className="footer-bar">
        <button type="button" className="btn btn--primary btn--block btn--lg" disabled={!ready || session.loading} onClick={go}>
          {session.loading ? 'Finding your stop…' : ready ? 'Show me two' : `${left} more ${left === 1 ? 'stop' : 'stops'}`}
          {ready && !session.loading && <ArrowIcon size={20} />}
        </button>
      </footer>
    </div>
  );
}
