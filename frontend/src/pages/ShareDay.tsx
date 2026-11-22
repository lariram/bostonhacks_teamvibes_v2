import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { DayLine } from '../components/DayLine';
import { ArrowIcon } from '../components/Icons';
import { TopBar } from '../components/TopBar';
import { api } from '../lib/api';
import type { MyDay } from '../lib/types';
import { dayName } from '../lib/util';

/** Share a whole day out (every stop, in order) as one feed post */
export default function ShareDay() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [day, setDay] = useState<MyDay | null>(null);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const date = params.get('date');
    api<MyDay>(`/day${date ? `?date=${date}` : ''}`).then((d) => {
      setDay(d);
      setCaption(d.caption);
    });
  }, [params]);

  async function share() {
    if (!day) return;
    setBusy(true);
    try {
      await api('/day/share', { body: { date: day.date, caption } });
      navigate('/feed');
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  if (!day) return <div className="screen center muted">Loading…</div>;
  const when = dayName(new Date(`${day.date}T12:00:00-05:00`));

  return (
    <div className="screen share-day">
      <TopBar back />
      <p className="label">{when === 'Today' ? 'Today' : when}</p>
      <h1 className="title">Your day out</h1>
      {day.stops.length < 2 ? (
        <>
          <p className="lede">Finish at least two stops to share your day. You've done {day.stops.length} so far.</p>
          <Link to="/discover" className="btn btn--primary btn--block btn--lg">
            Find your next stop <ArrowIcon size={20} />
          </Link>
        </>
      ) : (
        <>
          <p className="lede">
            {day.stops.length} stops, in the order you went. Your private reviews stay private; only your stars show.
          </p>
          <DayLine stops={day.stops} />
          <label className="field">
            <span className="label">Caption</span>
            <textarea
              className="input textarea"
              rows={3}
              maxLength={280}
              placeholder="How was the day?"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="button" className="btn btn--primary btn--block btn--lg" onClick={share} disabled={busy}>
            {day.sharedPostId ? 'Update your post' : 'Share to feed'} <ArrowIcon size={20} />
          </button>
        </>
      )}
    </div>
  );
}
