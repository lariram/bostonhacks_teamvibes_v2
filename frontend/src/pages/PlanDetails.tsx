import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { ArrowIcon, ChatIcon, LockIcon } from '../components/Icons';
import { Stars } from '../components/Stars';
import { TopBar } from '../components/TopBar';
import { LineDot, LineDots, StationSign } from '../components/Transit';
import { crewLine, LINES, linesFromStop, TYPE_COLORS, TYPE_LINE } from '../config';
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

  if (error)
    return (
      <div className="screen">
        <TopBar back="/history" />
        <p className="error">{error}</p>
      </div>
    );
  if (!plan) return <div className="screen center muted">Loading…</div>;

  const { place, group } = plan;
  const done = plan.status === 'completed';
  const others = group?.members.filter((m) => m.id !== me?.user.id) ?? [];
  const price = meta?.priceTiers.find((t) => t.id === place.price)?.label;
  const crewColor = group ? LINES[crewLine(group.id)] : undefined;

  return (
    <div className="screen with-footer details">
      <TopBar back={true} title={<span className="label label--muted">{done ? 'Completed' : 'Now boarding'}</span>} />

      <StationSign
        color={TYPE_COLORS[place.type]}
        kicker={
          <>
            <LineDot line={TYPE_LINE[place.type]} size={9} /> {place.type} · {plan.neighborhoodLabel}
          </>
        }
        title={place.name}
      >
        <LineDots lines={linesFromStop(place.tStop)} size={12} />
        <span>{place.tStop}</span>
      </StationSign>

      <div className="map">
        <iframe title={`Map of ${place.name}`} src={osmEmbedUrl(place.lat, place.lng)} loading="lazy" />
        <span className="map__pin" style={{ '--pin': TYPE_COLORS[place.type] } as CSSProperties} aria-hidden />
        <a className="map__open" href={mapsSearchUrl(place.name, place.address)} target="_blank" rel="noreferrer">
          Open in Maps <ArrowIcon size={14} />
        </a>
      </div>

      <dl className="facts">
        <div>
          <dt className="label">Address</dt>
          <dd>
            {place.address}
            <a href={transitDirectionsUrl(place.name, place.address)} target="_blank" rel="noreferrer" className="facts__link">
              Directions by T <ArrowIcon size={14} />
            </a>
          </dd>
        </div>
        <div>
          <dt className="label">Cost</dt>
          <dd>
            {place.priceNote} <span className="muted">({price})</span>
          </dd>
        </div>
        <div>
          <dt className="label">Time</dt>
          <dd>
            ~{formatMinutes(place.minutes)} <span className="muted">· best {place.times.map((t) => TIME_LABEL[t].toLowerCase()).join(', ')}</span>
          </dd>
        </div>
      </dl>

      <p className="details__blurb">{place.blurb}</p>
      <div className="local-tip">
        <span className="label">Local tip</span>
        <p>{place.localTip}</p>
      </div>

      {group && (
        <section className="crew" style={{ '--crew': crewColor } as CSSProperties}>
          <div className="crew__head">
            <span className="label">{group.status === 'forming' ? 'Your crew for this stop' : group.name}</span>
            <span className="label label--muted">{group.members.length} riders</span>
          </div>
          <ul className="people">
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
              <span className="muted">In common:</span> {group.sharedInterests.slice(0, 4).map((s) => s.tag).join(' · ')}
            </p>
          )}
          <Link to={`/groups/${group.id}`} className="btn btn--ghost btn--block">
            <ChatIcon size={18} /> Crew chat
          </Link>
          <p className="tiny muted center">Meet in public, and let a friend know where you're headed.</p>
        </section>
      )}

      {done && (
        <section className="your-rating">
          <span className="label">Your rating</span>
          <Stars value={plan.rating ?? 0} size={18} />
          {plan.review && (
            <p className="private">
              <LockIcon size={13} /> {plan.review}
            </p>
          )}
        </section>
      )}

      <footer className="footer-bar">
        {done ? (
          <button type="button" className="btn btn--primary btn--block btn--lg" onClick={() => navigate(`/plan/${plan.id}/next`)}>
            Next stop <ArrowIcon size={20} />
          </button>
        ) : (
          <button type="button" className="btn btn--primary btn--block btn--lg" onClick={() => navigate(`/plan/${plan.id}/rate`)}>
            I'm done, rate it
          </button>
        )}
      </footer>
    </div>
  );
}
