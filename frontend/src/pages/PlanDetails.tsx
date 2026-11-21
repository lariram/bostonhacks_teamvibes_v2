import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { ChatIcon, ClockIcon, LockIcon, PinIcon } from '../components/Icons';
import { PlaceBadge, TypePill } from '../components/PlaceBadge';
import { Stars } from '../components/Stars';
import { TopBar } from '../components/TopBar';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { Plan } from '../lib/types';
import { formatMinutes, mapsSearchUrl, osmEmbedUrl, TIME_LABEL, transitDirectionsUrl } from '../lib/util';

/** "Gives exact address (map) and more details" */
export default function PlanDetails() {
  const { id } = useParams();
  const { me, meta } = useAuth();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Plan>(`/plans/${id}`).then(setPlan).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <div className="screen"><TopBar back="/history" /><p className="error">{error}</p></div>;
  if (!plan) return <div className="screen center muted">Loading…</div>;

  const { place, group } = plan;
  const done = plan.status === 'completed';
  const others = group?.members.filter((m) => m.id !== me?.user.id) ?? [];
  const price = meta?.priceTiers.find((t) => t.id === place.price)?.label;

  return (
    <div className="screen with-footer details">
      <TopBar back={true} title={done ? 'Completed' : "You're going!"} />

      <div className="map">
        <iframe title={`Map of ${place.name}`} src={osmEmbedUrl(place.lat, place.lng)} loading="lazy" />
        <a className="map__open" href={mapsSearchUrl(place.name, place.address)} target="_blank" rel="noreferrer">
          <PinIcon size={16} /> Open in Maps
        </a>
      </div>

      <div className="details__head">
        <PlaceBadge place={place} size={64} />
        <div>
          <TypePill type={place.type} />
          <h1 className="title title--sm">{place.name}</h1>
          <p className="muted">{plan.neighborhoodLabel}</p>
        </div>
      </div>

      <section className="card">
        <div className="row">
          <PinIcon />
          <div>
            <strong>{place.address}</strong>
            <div className="row-links">
              <a href={mapsSearchUrl(place.name, place.address)} target="_blank" rel="noreferrer">
                Open in Maps
              </a>
              <a href={transitDirectionsUrl(place.name, place.address)} target="_blank" rel="noreferrer">
                Transit directions
              </a>
            </div>
          </div>
        </div>
        <div className="row">
          <span className="t-logo" aria-hidden>T</span>
          <div>
            <strong>{place.tStop}</strong>
            <p className="small muted">Nearest T</p>
          </div>
        </div>
        <div className="row">
          <ClockIcon />
          <div>
            <strong>~{formatMinutes(place.minutes)}</strong>
            <p className="small muted">Best: {place.times.map((t) => TIME_LABEL[t]).join(', ')}</p>
          </div>
        </div>
        <div className="row">
          <span className="dollar" aria-hidden>$</span>
          <div>
            <strong>{place.priceNote}</strong>
            <p className="small muted">{price}</p>
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="subhead">Details</h2>
        <p>{place.blurb}</p>
        <div className="local-tip">
          <span className="local-tip__label">Local tip</span>
          <p>{place.localTip}</p>
        </div>
        <div className="chips chips--static">
          {place.tags.map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
        </div>
      </section>

      {group && (
        <section className="card crew">
          <div className="crew__head">
            <h2 className="subhead">{group.status === 'forming' ? 'Your crew for this' : group.name}</h2>
            <span className="badge">{group.members.length} people</span>
          </div>
          <ul className="crew__list">
            {others.map((m) => (
              <li key={m.id}>
                <Avatar user={m} size={40} />
                <div>
                  <strong>{m.firstName}</strong>, {m.age}
                  <p className="small muted">{m.school}</p>
                </div>
              </li>
            ))}
          </ul>
          {group.sharedInterests.length > 0 && (
            <p className="small">
              <strong>In common:</strong> {group.sharedInterests.slice(0, 4).map((s) => s.tag).join(', ')}
            </p>
          )}
          <Link to={`/groups/${group.id}`} className="btn btn--ghost btn--block">
            <ChatIcon size={20} /> Open group chat
          </Link>
          <p className="tiny muted center">Meet in public, and let a friend know where you're headed.</p>
        </section>
      )}

      {done && (
        <section className="card">
          <h2 className="subhead">Your rating</h2>
          <Stars value={plan.rating ?? 0} size={22} />
          {plan.review && (
            <div className="private">
              <LockIcon size={14} /> <span className="small muted">Only you can see this</span>
              <p>{plan.review}</p>
            </div>
          )}
        </section>
      )}

      <footer className="footer-bar">
        {done ? (
          <button type="button" className="btn btn--primary btn--block btn--lg" onClick={() => navigate(`/plan/${plan.id}/next`)}>
            What's next?
          </button>
        ) : (
          <button type="button" className="btn btn--primary btn--block btn--lg" onClick={() => navigate(`/plan/${plan.id}/rate`)}>
            Finished? Rate it
          </button>
        )}
      </footer>
    </div>
  );
}
