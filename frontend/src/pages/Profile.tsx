import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar, AvatarStack } from '../components/Avatar';
import { TYPE_COLORS } from '../config';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { Group } from '../lib/types';

export default function Profile() {
  const { me, refresh, signOut } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<Group[]>([]);

  useEffect(() => {
    refresh();
    api<Group[]>('/groups').then(setGroups);
  }, [refresh]);

  if (!me) return null;
  const { user, stats, bingo, learnedFavorites } = me;
  const visited = bingo.filter((b) => b.visited).length;

  return (
    <div className="screen profile">
      <header className="profile__head">
        <Avatar user={user} size={84} />
        <h1 className="title title--sm">{user.fullName}</h1>
        <p className="muted">@{user.username}</p>
      </header>

      <div className="stats">
        <div>
          <strong>{stats.completed}</strong>
          <span>done</span>
        </div>
        <div>
          <strong>{stats.avgRating ?? '–'}</strong>
          <span>avg ★</span>
        </div>
        <div>
          <strong>{stats.groups}</strong>
          <span>crews</span>
        </div>
        <div>
          <strong>{visited}/{bingo.length}</strong>
          <span>hoods</span>
        </div>
      </div>

      <section className="card">
        <div className="card__head">
          <h2 className="subhead">Boston Bingo</h2>
          <span className="small muted">Explore every neighborhood</span>
        </div>
        <div className="bingo">
          {bingo.map((b) => (
            <span key={b.id} className={`bingo__cell${b.visited ? ' on' : ''}`}>
              {b.label.replace(' Boston', '')}
            </span>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card__head">
          <h2 className="subhead">Your crews</h2>
        </div>
        {groups.length === 0 ? (
          <p className="small muted">
            No crews yet. Turn on <em>Form a group</em> when you generate, and keep the people you click with.
          </p>
        ) : (
          <ul className="group-list">
            {groups.map((g) => (
              <li key={g.id}>
                <Link to={`/groups/${g.id}`}>
                  <AvatarStack users={g.members} size={30} max={4} />
                  <div>
                    <strong>{g.name}</strong>
                    <p className="small muted">
                      {g.members.length} people · {g.activities.length} {g.activities.length === 1 ? 'outing' : 'outings'}
                      {g.status === 'forming' && ' · forming'}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <div className="card__head">
          <h2 className="subhead">Your interests</h2>
          <Link to="/onboarding?edit=1" className="small">
            Edit
          </Link>
        </div>
        <div className="chips chips--static">
          {(['food', 'event', 'activity'] as const).flatMap((cat) =>
            user.preferences[cat].map((t) => (
              <span key={cat + t} className="tag" style={{ borderColor: TYPE_COLORS[cat], color: TYPE_COLORS[cat] }}>
                {t}
              </span>
            )),
          )}
          {!user.preferences.food.length && !user.preferences.event.length && !user.preferences.activity.length && (
            <span className="small muted">None yet. Add some for better picks.</span>
          )}
        </div>
        {learnedFavorites.length > 0 && (
          <p className="small learned">
            <strong>We've noticed you love:</strong> {learnedFavorites.join(', ')}
          </p>
        )}
      </section>

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
