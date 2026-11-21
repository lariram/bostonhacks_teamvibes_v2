import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LockIcon, UsersIcon } from '../components/Icons';
import { PlaceBadge } from '../components/PlaceBadge';
import { Stars } from '../components/Stars';
import { api } from '../lib/api';
import type { Plan } from '../lib/types';
import { timeAgo } from '../lib/util';

export default function History() {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  useEffect(() => {
    api<Plan[]>('/history').then(setPlans);
  }, []);

  const active = plans?.filter((p) => p.status === 'active') ?? [];
  const done = plans?.filter((p) => p.status === 'completed') ?? [];

  return (
    <div className="screen">
      <h1 className="title">History</h1>
      <p className="lede">Your Boston, one spot at a time. Reviews here are private.</p>
      {!plans && <p className="muted center">Loading…</p>}
      {plans?.length === 0 && (
        <p className="notice">
          Nothing yet! <Link to="/discover">Generate your first recommendation</Link>.
        </p>
      )}
      {active.length > 0 && (
        <>
          <h2 className="subhead">In progress</h2>
          <ul className="history">{active.map((p) => <HistoryItem key={p.id} plan={p} />)}</ul>
        </>
      )}
      {done.length > 0 && (
        <>
          <h2 className="subhead">Done</h2>
          <ul className="history">{done.map((p) => <HistoryItem key={p.id} plan={p} />)}</ul>
        </>
      )}
    </div>
  );
}

function HistoryItem({ plan }: { plan: Plan }) {
  return (
    <li>
      <Link to={`/plan/${plan.id}`} className="history__item">
        <PlaceBadge place={plan.place} size={48} />
        <div className="history__body">
          <strong>{plan.place.name}</strong>
          <p className="small muted">
            {plan.neighborhoodLabel} · {timeAgo(plan.completedAt ?? plan.createdAt)}
            {plan.group && (
              <>
                {' '}
                · <UsersIcon size={12} /> {plan.group.name}
              </>
            )}
          </p>
          {plan.rating ? <Stars value={plan.rating} size={14} /> : <span className="badge badge--live">Happening now</span>}
          {plan.review && (
            <p className="history__review small">
              <LockIcon size={12} /> {plan.review}
            </p>
          )}
        </div>
      </Link>
    </li>
  );
}
