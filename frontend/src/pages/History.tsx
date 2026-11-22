import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LockIcon } from '../components/Icons';
import { TypeTag } from '../components/PlaceBadge';
import { Stars } from '../components/Stars';
import { LineDot, LineTimeline } from '../components/Transit';
import { crewLine } from '../config';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { Plan } from '../lib/types';
import { timeAgo } from '../lib/util';

const stopsLabel = (n: number) => (n === 0 ? 'No stops yet' : `${n} ${n === 1 ? 'stop' : 'stops'} so far`);

/** History, drawn as your own line: every place you've been is a stop. */
export default function History() {
  const { me } = useAuth();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  useEffect(() => {
    api<Plan[]>('/history').then(setPlans);
  }, []);

  return (
    <div className="screen">
      <p className="label">{plans ? stopsLabel(plans.filter((p) => p.status === 'completed').length) : 'History'}</p>
      <h1 className="title">My line</h1>
      <p className="lede">Every place you've been is a stop. Notes here are private.</p>
      {!plans && <p className="muted center">Loading…</p>}
      {plans?.length === 0 && (
        <div className="empty">
          <p>Your line is empty.</p>
          <Link to="/discover" className="btn btn--primary">
            Find your first stop
          </Link>
        </div>
      )}
      {plans && plans.length > 0 && (
        <LineTimeline
          items={plans}
          color={me?.user.avatarColor ?? '#0b0b0c'}
          isCurrent={(p) => p.status === 'active'}
          render={(plan) => (
            <Link to={`/plan/${plan.id}`} className="stop-link">
              <TypeTag type={plan.place.type}>{plan.neighborhoodLabel}</TypeTag>
              <strong className="stop-link__name">{plan.place.name}</strong>
              <span className="small muted">
                {plan.status === 'active' ? <span className="live">Now</span> : timeAgo(plan.completedAt ?? plan.createdAt)}
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
          )}
        />
      )}
    </div>
  );
}
