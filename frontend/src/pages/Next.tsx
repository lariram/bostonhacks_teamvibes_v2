import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AvatarStack } from '../components/Avatar';
import { ArrowIcon } from '../components/Icons';
import { crewLine, LINES, TYPE_COLORS } from '../config';
import { api } from '../lib/api';
import { useRecSession } from '../lib/session';
import type { Group, MyDay, Plan } from '../lib/types';

/** "Want another activity with the same group?" / "Want another solo activity?" */
export default function Next() {
  const { id } = useParams();
  const navigate = useNavigate();
  const session = useRecSession();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [day, setDay] = useState<MyDay | null>(null);

  useEffect(() => {
    api<Plan>(`/plans/${id}`).then((p) => {
      setPlan(p);
      if (p.group) setName(p.group.name);
    });
    api<MyDay>('/day').then(setDay);
  }, [id]);

  async function keepCrew() {
    if (!plan?.group) return;
    setBusy(true);
    const g = await api<Group>(`/groups/${plan.group.id}/keep`, { body: { name } });
    // keep the last request so location/time carry over to the group's next pick
    navigate(`/discover?group=${g.id}`);
  }

  function solo() {
    session.clear();
    navigate('/discover');
  }

  if (!plan) return <div className="screen center muted">Loading…</div>;
  const group = plan.group;
  const color = group ? LINES[crewLine(group.id)] : TYPE_COLORS[plan.place.type];

  return (
    <div className="screen next" style={{ '--line': color } as CSSProperties}>
      {/* you are here → ? */}
      <div className="next__line" aria-hidden>
        <span className="next__done" />
        <span className="next__track" />
        <span className="next__q">?</span>
      </div>
      <p className="label center">{plan.place.name} ✓</p>
      <h1 className="title center">Next stop?</h1>

      {group ? (
        <section className="next__crew">
          <AvatarStack users={group.members} size={44} />
          <p className="center">
            Stay on with this group? We'll save a group profile and only suggest things that work for all {group.members.length} of you.
          </p>
          {group.status === 'forming' && (
            <label className="field">
              <span className="label">Name the group</span>
              <input className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
            </label>
          )}
          <button type="button" className="btn btn--primary btn--block btn--lg" disabled={busy} onClick={keepCrew}>
            Stay with the group <ArrowIcon size={20} />
          </button>
          <button type="button" className="btn btn--ghost btn--block" onClick={solo}>
            Ride solo
          </button>
        </section>
      ) : (
        <section className="next__crew">
          <button type="button" className="btn btn--primary btn--block btn--lg" onClick={solo}>
            Find another <ArrowIcon size={20} />
          </button>
          <p className="small center muted">Tip: pick "Find me a group" next time to meet people along the way.</p>
        </section>
      )}

      {day && (day.stops.length >= 2 || day.savedForLater > 0) && (
        <section className="next__share">
          <p className="label">Done for the day?</p>
          {day.stops.length >= 2 ? (
            <Link to={`/day/share?date=${day.date}`} className={`btn btn--block ${day.savedForLater ? 'btn--primary' : 'btn--ghost'}`}>
              {day.sharedPostId ? 'Update your shared day' : `Post your day · ${day.stops.length} stops`}
            </Link>
          ) : null}
          {day.savedForLater > 0 && !day.sharedPostId && (
            <p className="small muted">
              {day.savedForLater} {day.savedForLater === 1 ? 'stop is' : 'stops are'} saved for your day post.
              {day.stops.length < 2 && ' Finish one more stop to post your day.'}
            </p>
          )}
        </section>
      )}

      <div className="next__links">
        <Link to="/feed">Feed</Link>
        <Link to="/history">My line</Link>
      </div>
    </div>
  );
}
