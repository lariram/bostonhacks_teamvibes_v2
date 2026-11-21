import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AvatarStack } from '../components/Avatar';
import { CheckIcon } from '../components/Icons';
import { api } from '../lib/api';
import { useRecSession } from '../lib/session';
import type { Group, Plan } from '../lib/types';

/** "Want another activity with the same group?" / "Want another solo activity?" */
export default function Next() {
  const { id } = useParams();
  const navigate = useNavigate();
  const session = useRecSession();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Plan>(`/plans/${id}`).then((p) => {
      setPlan(p);
      if (p.group) setName(p.group.name);
    });
  }, [id]);

  async function keepCrew() {
    if (!plan?.group) return;
    setBusy(true);
    const g = await api<Group>(`/groups/${plan.group.id}/keep`, { body: { name } });
    // keep the last request so location/time carry over to the crew's next pick
    navigate(`/discover?group=${g.id}`);
  }

  function solo() {
    session.clear();
    navigate('/discover');
  }

  if (!plan) return <div className="screen center muted">Loading…</div>;
  const group = plan.group;

  return (
    <div className="screen next">
      <div className="next__check">
        <CheckIcon size={36} />
      </div>
      <h1 className="title center">Nice, you did {plan.place.name}!</h1>

      {group ? (
        <section className="card next__crew">
          <AvatarStack users={group.members} size={44} />
          <h2 className="subhead center">Want another activity with the same group?</h2>
          <p className="small center muted">
            We'll save a group profile and only suggest things that suit all {group.members.length} of you.
          </p>
          {group.status === 'forming' && (
            <label className="field">
              <span className="field__label">Name your crew</span>
              <input className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
            </label>
          )}
          <button type="button" className="btn btn--primary btn--block btn--lg" disabled={busy} onClick={keepCrew}>
            Yes, keep the crew together
          </button>
          <button type="button" className="btn btn--ghost btn--block" onClick={solo}>
            Go solo for the next one
          </button>
        </section>
      ) : (
        <section className="card">
          <h2 className="subhead center">Want another solo activity?</h2>
          <button type="button" className="btn btn--primary btn--block btn--lg" onClick={solo}>
            Yes, find me something
          </button>
          <p className="small center muted">Tip: turn on "Form a group" next time to meet people along the way.</p>
        </section>
      )}

      <div className="next__links">
        <Link to="/feed">See the feed</Link>
        <Link to="/history">My history</Link>
      </div>
    </div>
  );
}
