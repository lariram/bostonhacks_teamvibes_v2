import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar, AvatarStack } from '../components/Avatar';
import { BostonMap, LineDot } from '../components/Transit';
import { TStopMap } from '../components/TStopMap';
import { crewLine, LINES, TYPE_LINE } from '../config';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { Group } from '../lib/types';

export default function Profile() {
  const { me, meta, refresh, signOut } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<Group[]>([]);
  const [bingoMode, setBingoMode] = useState<'hoods' | 'stops'>(
    () => (localStorage.getItem('bingoMode') as 'hoods' | 'stops') ?? 'hoods',
  );
  const pickMode = (m: 'hoods' | 'stops') => {
    setBingoMode(m);
    localStorage.setItem('bingoMode', m);
  };

  useEffect(() => {
    refresh();
    api<Group[]>('/groups').then(setGroups);
  }, [refresh]);

  if (!me) return null;
  const { user, stats, bingo, tStops, learnedFavorites } = me;
  const visited = new Set(bingo.filter((b) => b.visited).map((b) => b.id));
  const isGuest = user.isGuest;

  return (
    <div className="screen profile">
      <header className="profile__head">
        <Avatar user={user} size={72} />
        <div>
          <h1 className="title title--sm">{user.fullName}</h1>
          <p className="muted small">
            @{user.username}
            {' · '}
            <Link to="/onboarding?edit=1&step=who" className="persona-tag">
              {meta?.personas.find((p) => p.id === user.persona)?.label ?? 'Add who you are'}
            </Link>
          </p>
        </div>
      </header>

      <div className="stats">
        <div>
          <strong>{stats.completed}</strong>
          <span className="label label--muted">stops</span>
        </div>
        <div>
          <strong>{stats.avgRating ?? '–'}</strong>
          <span className="label label--muted">avg ★</span>
        </div>
        <div>
          <strong>{stats.groups}</strong>
          <span className="label label--muted">crews</span>
        </div>
      </div>

      <section className="panel">
        <div className="panel__head">
          <h2 className="label">Your Boston</h2>
          <span className="label label--muted">
            {bingoMode === 'hoods'
              ? `${visited.size} / ${bingo.length} neighborhoods`
              : `${tStops.visited} / ${tStops.total} stops`}
          </span>
        </div>
        <div className="segmented segmented--sm bingo-switch" role="tablist" aria-label="Bingo map">
          <button role="tab" aria-selected={bingoMode === 'hoods'} className={bingoMode === 'hoods' ? 'on' : ''} onClick={() => pickMode('hoods')}>
            Neighborhoods
          </button>
          <button role="tab" aria-selected={bingoMode === 'stops'} className={bingoMode === 'stops' ? 'on' : ''} onClick={() => pickMode('stops')}>
            T stops
          </button>
        </div>
        {bingoMode === 'hoods' ? (
          <>
            <BostonMap visited={visited} />
            <p className="small muted">Every neighborhood you explore lights up. Collect all twelve.</p>
          </>
        ) : (
          <>
            <TStopMap data={tStops} />
            <p className="small muted">
              Each place you go checks off its nearest stop. All {tStops.total} subway, trolley and Silver Line stops count. Zoom in to read every name.
            </p>
          </>
        )}
      </section>

      <section className="panel">
        <div className="panel__head">
          <h2 className="label">Crews</h2>
        </div>
        {groups.length === 0 ? (
          <p className="small muted">No crews yet. Choose "Find me a crew" when you plan, and keep the people you click with.</p>
        ) : (
          <ul className="crew-list">
            {groups.map((g) => (
              <li key={g.id} style={{ '--crew': LINES[crewLine(g.id)] } as CSSProperties}>
                <Link to={`/groups/${g.id}`}>
                  <span className="crew-list__bar" aria-hidden />
                  <div>
                    <strong>{g.name}</strong>
                    <p className="small muted">
                      {g.members.length} riders · {g.activities.length} {g.activities.length === 1 ? 'stop' : 'stops'}
                      {g.status === 'forming' && ' · forming'}
                    </p>
                  </div>
                  <AvatarStack users={g.members} size={26} max={4} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <div className="panel__head">
          <h2 className="label">Into</h2>
          <Link to="/onboarding?edit=1" className="label">
            Edit
          </Link>
        </div>
        <div className="tags">
          {(['food', 'event', 'activity'] as const).flatMap((cat) =>
            user.preferences[cat].map((t) => (
              <span key={cat + t} className="tag">
                <LineDot line={TYPE_LINE[cat]} size={7} /> {t}
              </span>
            )),
          )}
          {!user.preferences.food.length && !user.preferences.event.length && !user.preferences.activity.length && (
            <span className="small muted">Nothing yet. Add some for better picks.</span>
          )}
        </div>
        {learnedFavorites.length > 0 && (
          <p className="small learned">
            <span className="muted">Lately you love</span> {learnedFavorites.join(' · ')}
          </p>
        )}
      </section>

      {isGuest && <p className="small muted center">You're riding as a guest. Logging out ends this account.</p>}
      <button
        type="button"
        className="btn btn--ghost btn--block"
        onClick={() => {
          signOut();
          navigate('/', { replace: true });
        }}
      >
        Log out
      </button>
    </div>
  );
}
