import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import type { Place, Plan } from '../lib/types';
import { bostonTime, clock, dayName, durationLabel, startSlots, upcomingDays } from '../lib/util';
import { Chip } from './Chip';
import { Sheet } from './Sheet';

interface Props {
  place: Place | null;
  onClose: () => void;
  onAdded: (plan: Plan) => void;
  /** Prefill (e.g. the start time you searched for) */
  defaultStart?: Date;
  defaultMinutes?: number;
}

const DURATIONS = [30, 60, 90, 120, 180, 240];

/** Put something on your in-app calendar (My line), no external calendar needed */
export function AddToCalendarSheet({ place, onClose, onAdded, defaultStart, defaultMinutes }: Props) {
  const days = useMemo(() => upcomingDays(14), []);
  const fixed = !!place?.live && !place.live.openHours && !place.live.timeTBA;
  const [dayIdx, setDayIdx] = useState(0);
  const [start, setStart] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(120);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slots = useMemo(() => startSlots(days[dayIdx]), [days, dayIdx]);

  // Reset to sensible defaults whenever a new place opens the sheet
  useEffect(() => {
    if (!place) return;
    const d = defaultStart && defaultStart.getTime() > Date.now() ? defaultStart : null;
    const idx = d ? Math.max(0, days.findIndex((x) => x.toDateString() === d.toDateString())) : 0;
    setDayIdx(idx);
    const daySlots = startSlots(days[idx]);
    const near = d ? daySlots.find((t) => t.getTime() >= d.getTime() - 15 * 60_000) : daySlots[0];
    setStart((near ?? daySlots[0])?.toISOString() ?? null);
    const want = defaultMinutes ?? place.minutes;
    setMinutes(DURATIONS.reduce((a, b) => (Math.abs(b - want) < Math.abs(a - want) ? b : a)));
    setError(null);
  }, [place, defaultStart, defaultMinutes, days]);

  async function add() {
    if (!place) return;
    setBusy(true);
    setError(null);
    try {
      const plan = await api<Plan>('/plans', {
        body: {
          placeId: place.id,
          request: {
            location: place.neighborhood === 'greater' ? 'anywhere' : place.neighborhood,
            type: place.type,
            price: '40plus',
            durationMinutes: minutes,
            startAt: fixed ? place.live!.startsAt : start ?? undefined,
          },
        },
      });
      onAdded(plan);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={!!place} onClose={onClose} label="Add to my calendar">
      {place && (
        <>
          <p className="label">Add to my calendar</p>
          <h2 className="title title--sm">{place.name}</h2>
          {fixed ? (
            <p className="lede">
              {dayName(new Date(place.live!.startsAt))} · {bostonTime(place.live!.startsAt)}
            </p>
          ) : (
            <>
              <h3 className="label sheet__label">Day</h3>
              <div className="time-scroller">
                {days.map((d, i) => (
                  <Chip
                    key={d.toDateString()}
                    selected={dayIdx === i}
                    onClick={() => {
                      setDayIdx(i);
                      setStart(startSlots(d).find((t) => t.getHours() === 19)?.toISOString() ?? startSlots(d)[0]?.toISOString() ?? null);
                    }}
                  >
                    {i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                  </Chip>
                ))}
              </div>
              <h3 className="label sheet__label">Starting</h3>
              <div className="time-scroller">
                {slots.map((t) => (
                  <Chip key={t.toISOString()} selected={start === t.toISOString()} onClick={() => setStart(t.toISOString())}>
                    {clock(t)}
                  </Chip>
                ))}
              </div>
              <h3 className="label sheet__label">For</h3>
              <div className="chips">
                {DURATIONS.map((m) => (
                  <Chip key={m} selected={minutes === m} onClick={() => setMinutes(m)}>
                    {durationLabel(m)}
                  </Chip>
                ))}
              </div>
            </>
          )}
          <p className="small muted sheet__note">It goes on My line. You can send it to Google or Apple Calendar later if you want.</p>
          {error && <p className="error">{error}</p>}
          <button type="button" className="btn btn--primary btn--block btn--lg" disabled={busy || (!fixed && !start)} onClick={add}>
            {busy ? 'Adding…' : 'Add to my calendar'}
          </button>
        </>
      )}
    </Sheet>
  );
}
