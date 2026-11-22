import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { MapView } from '../components/MapView';
import { PlacePhoto } from '../components/PlacePhoto';
import { FollowButton } from '../components/FollowButton';
import { ArrowIcon, ChatIcon, CheckIcon, LockIcon } from '../components/Icons';
import { Stars } from '../components/Stars';
import { TopBar } from '../components/TopBar';
import { LineDot, LineDots, StationSign } from '../components/Transit';
import { crewLine, LINES, linesFromStop, TYPE_COLORS, TYPE_LINE } from '../config';
import { api, downloadFile } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { Plan } from '../lib/types';
import { bostonTime, dayName, formatMinutes, googleCalendarUrl, liveRange, liveWhen, mapsSearchUrl, TIME_LABEL, timeAgo, transitDirectionsUrl } from '../lib/util';

const updatedAgo = (iso: string) => {
  const t = timeAgo(iso);
  return t === 'just now' ? t : `${t} ago`;
};

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

      {place.image && <PlacePhoto place={place} variant="hero" />}
      <StationSign
        color={TYPE_COLORS[place.type]}
        kicker={
          place.live ? (
            <>
              <span className="live-dot" aria-hidden /> {liveWhen(place.live)} · {plan.neighborhoodLabel}
            </>
          ) : (
            <>
              <LineDot line={TYPE_LINE[place.type]} size={9} /> {place.type} · {plan.neighborhoodLabel}
            </>
          )
        }
        title={place.name}
      >
        <LineDots lines={linesFromStop(place.tStop)} size={12} />
        <span>{place.tStop}</span>
      </StationSign>

      <div className="map-wrap">
        <MapView lat={place.lat} lng={place.lng} color={TYPE_COLORS[place.type]} station={plan.station} approx={place.live?.approxLocation} />
        <a className="map__open" href={mapsSearchUrl(place.name, place.address)} target="_blank" rel="noreferrer">
          Open in Maps <ArrowIcon size={14} />
        </a>
      </div>
      {place.live?.approxLocation && <p className="tiny muted">Pin shows the neighborhood. The event page has the exact spot.</p>}

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
        {plan.hours && (
          <div>
            <dt className="label">Hours</dt>
            <dd>
              {plan.hours.text}
              {plan.hours.approx && <span className="muted"> · approximate, check before you go</span>}
            </dd>
          </div>
        )}
        <div>
          <dt className="label">Cost</dt>
          <dd>
            {place.priceNote} {price && price !== place.priceNote && <span className="muted">({price})</span>}
          </dd>
        </div>
        <div>
          <dt className="label">Time</dt>
          <dd>
            {place.live && !place.live.openHours ? (
              <>
                {dayName(new Date(place.live.startsAt))}, {liveRange(place.live)}
                {place.live.endEstimated && !place.live.timeTBA && <span className="muted"> · about {formatMinutes(place.minutes)}</span>}
              </>
            ) : (
              <>
                ~{formatMinutes(place.minutes)} <span className="muted">· best {place.times.map((t) => TIME_LABEL[t].toLowerCase()).join(', ')}</span>
              </>
            )}
          </dd>
        </div>
        {place.live && (
          <div>
            <dt className="label">Listing</dt>
            <dd>
              {place.live.sourceName}
              <span className="muted"> · updated {updatedAgo(place.live.fetchedAt)}</span>
              <span className="facts__links">
                <a href={place.live.url} target="_blank" rel="noreferrer" className="facts__link">
                  Event page <ArrowIcon size={14} />
                </a>
                {place.live.ticketUrl && place.live.ticketUrl !== place.live.url && (
                  <a href={place.live.ticketUrl} target="_blank" rel="noreferrer" className="facts__link">
                    {place.live.source === 'localist' ? 'Register' : 'Tickets'} <ArrowIcon size={14} />
                  </a>
                )}
              </span>
            </dd>
          </div>
        )}
      </dl>

      <p className="details__blurb">{place.blurb}</p>
      <div className="local-tip">
        <span className="label">{place.live ? 'Good to know' : 'Local tip'}</span>
        <p>{place.localTip}</p>
      </div>

      {plan.startsAt && plan.status === 'active' && (
        <section className="add-cal">
          <div className="add-cal__head">
            <Link to="/history?view=calendar" className="label in-app-cal">
              <CheckIcon size={14} /> On your OutBound calendar
            </Link>
            <span className="small muted">
              {dayName(new Date(plan.startsAt))} · {bostonTime(plan.startsAt)}
              {plan.endsAt ? `–${bostonTime(plan.endsAt)}` : ''}
            </span>
          </div>
          <p className="tiny muted add-cal__also">Also add it to:</p>
          <div className="add-cal__buttons">
            <a
              className="btn btn--ghost btn--sm"
              target="_blank"
              rel="noreferrer"
              href={googleCalendarUrl({
                title: place.name,
                start: new Date(plan.startsAt),
                end: new Date(plan.endsAt ?? plan.startsAt),
                location: place.address,
                details: `${place.blurb}\nNearest T: ${place.tStop}${place.live ? `\n${place.live.url}` : ''}\nPlanned with OutBound`,
              })}
            >
              Google Calendar
            </a>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => downloadFile(`/plans/${plan.id}/calendar.ics`, `${place.name}.ics`)}>
              Apple / Outlook (.ics)
            </button>
          </div>
        </section>
      )}

      {group && (
        <section className="crew" style={{ '--crew': crewColor } as CSSProperties}>
          <div className="crew__head">
            <span className="label">{group.status === 'forming' ? 'Your crew for this stop' : group.name}</span>
            <span className="label label--muted">{group.members.length} riders</span>
          </div>
          <ul className="people">
            {others.map((m) => (
              <li key={m.id}>
                <Link to={`/people/${m.id}`} className="person-link">
                  <Avatar user={m} size={40} />
                  <div>
                    <strong>{m.firstName}</strong>, {m.age}
                    <p className="small muted">{m.school}</p>
                  </div>
                </Link>
                <FollowButton userId={m.id} initial={!!me?.user.following?.includes(m.id)} />
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
