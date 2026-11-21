import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AvatarStack } from '../components/Avatar';
import { Chip, ChipSection } from '../components/Chip';
import { SparkleIcon, UsersIcon } from '../components/Icons';
import { TYPE_COLORS } from '../config';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useRecSession } from '../lib/session';
import type { DurationId, Group, PlaceType, PriceTier, RecRequest, TimeOfDay } from '../lib/types';
import { currentTimeOfDay, TIME_LABEL } from '../lib/util';

type When = 'now' | TimeOfDay;

/** "Generate Recommendations" */
export default function Discover() {
  const { meta, me } = useAuth();
  const session = useRecSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const groupId = params.get('group');
  const [group, setGroup] = useState<Group | null>(null);

  // Start from the last request so "another activity" is one tap away
  const last = session.request;
  const [location, setLocation] = useState<string | null>(last?.location ?? null);
  const [type, setType] = useState<PlaceType | null>(last?.type ?? null);
  const [price, setPrice] = useState<PriceTier | null>(last?.price ?? me?.user.lastPrice ?? null);
  const [duration, setDuration] = useState<DurationId | null>(last?.duration ?? null);
  const [when, setWhen] = useState<When>('now');
  const [groupMode, setGroupMode] = useState<boolean>(last?.groupMode ?? false);

  useEffect(() => {
    if (!groupId) return setGroup(null);
    api<Group>(`/groups/${groupId}`).then(setGroup).catch(() => setGroup(null));
  }, [groupId]);

  const tierRank = (t: PriceTier) => meta?.priceTiers.findIndex((p) => p.id === t) ?? 0;
  const groupBudgetRank = group ? tierRank(group.budget) : Infinity;
  const nowBucket = useMemo(() => currentTimeOfDay(), []);

  // Default to the crew's budget, and never sit above it
  useEffect(() => {
    if (group && (!price || tierRank(price) > groupBudgetRank)) setPrice(group.budget);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group]);

  const ready = location && type && price && duration;

  async function go() {
    if (!ready) return;
    const req: RecRequest = {
      location,
      type,
      price,
      duration,
      timeOfDay: when === 'now' ? nowBucket : when,
      groupMode: group ? false : groupMode,
      groupId: group?.id,
    };
    if (await session.generate(req)) navigate('/discover/results');
  }

  if (!meta) return <div className="screen center muted">Loading…</div>;

  return (
    <div className="screen with-footer">
      <h1 className="title">Generate Recommendations</h1>

      {group ? (
        <div className="group-banner">
          <AvatarStack users={group.members} size={30} />
          <div>
            <strong>Planning for {group.name}</strong>
            <p className="small">
              Only things that suit all {group.members.length} of you.{' '}
              <Link to="/discover" replace>
                Plan solo instead
              </Link>
            </p>
          </div>
        </div>
      ) : (
        <p className="lede">
          Hi {me?.user.firstName}! Where are you headed?
        </p>
      )}

      <ChipSection title="Location" hint="Select one">
        {meta.neighborhoods.map((n) => (
          <Chip key={n.id} selected={location === n.id} onClick={() => setLocation(n.id)}>
            {n.label}
          </Chip>
        ))}
        <Chip selected={location === 'anywhere'} onClick={() => setLocation('anywhere')}>
          Anywhere 🗺️
        </Chip>
      </ChipSection>

      <ChipSection title="Type" hint="Select one">
        {meta.types.map((t) => (
          <Chip key={t.id} selected={type === t.id} color={TYPE_COLORS[t.id]} onClick={() => setType(t.id)}>
            {t.label}
          </Chip>
        ))}
      </ChipSection>

      <ChipSection
        title="Price Range"
        hint={group ? `Capped at ${meta.priceTiers[groupBudgetRank]?.label} so it works for everyone` : 'Select one'}
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
      </ChipSection>

      <ChipSection title="Time frame" hint="When are you going?">
        <Chip selected={when === 'now'} onClick={() => setWhen('now')}>
          Right now
        </Chip>
        {meta.timesOfDay.map((t) => (
          <Chip key={t.id} selected={when === t.id} onClick={() => setWhen(t.id)}>
            {t.label}
          </Chip>
        ))}
      </ChipSection>
      <div className="chips chips--follow">
        <p className="hint full">How long do you have?</p>
        {meta.durations.map((d) => (
          <Chip key={d.id} selected={duration === d.id} onClick={() => setDuration(d.id)}>
            {d.label}
          </Chip>
        ))}
      </div>

      {!group && (
        <section className={`group-toggle${groupMode ? ' on' : ''}`}>
          <div className="group-toggle__icon">
            <UsersIcon size={26} />
          </div>
          <div className="group-toggle__text">
            <h2 className="subhead">Form a group?</h2>
            <p className="small">
              We'll match you with Bostonians heading to the same spot. Like the crew? Keep them for the rest of the day.
            </p>
          </div>
          <div className="yesno" role="radiogroup" aria-label="Form a group">
            <button type="button" role="radio" aria-checked={groupMode} className={groupMode ? 'on' : ''} onClick={() => setGroupMode(true)}>
              Yes
            </button>
            <button type="button" role="radio" aria-checked={!groupMode} className={!groupMode ? 'on' : ''} onClick={() => setGroupMode(false)}>
              No
            </button>
          </div>
        </section>
      )}

      {session.error && <p className="error">{session.error}</p>}

      <footer className="footer-bar">
        <button type="button" className="btn btn--primary btn--block btn--lg" disabled={!ready || session.loading} onClick={go}>
          <SparkleIcon size={20} />
          {session.loading ? 'Finding your spots…' : ready ? 'Generate' : 'Pick location, type, price & time'}
        </button>
      </footer>
      {when === 'now' && <p className="sr-only">Right now counts as {TIME_LABEL[nowBucket]}</p>}
    </div>
  );
}
