import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { FollowButton } from '../components/FollowButton';
import { TypeTag } from '../components/PlaceBadge';
import { Stars } from '../components/Stars';
import { TopBar } from '../components/TopBar';
import { api } from '../lib/api';
import type { PersonProfile } from '../lib/types';
import { timeAgo } from '../lib/util';

/** Someone else's profile: who they are, where they've been, follow them */
export default function Person() {
  const { id } = useParams();
  const [p, setP] = useState<PersonProfile | null>(null);
  const [followers, setFollowers] = useState(0);
  useEffect(() => {
    api<PersonProfile>(`/users/${id}`).then((r) => {
      setP(r);
      setFollowers(r.followers);
    });
  }, [id]);
  if (!p) return <div className="screen center muted">Loading…</div>;
  const { user } = p;

  return (
    <div className="screen">
      <TopBar back={true} />
      <header className="profile__head">
        <Avatar user={user} size={72} />
        <div>
          <h1 className="title title--sm">{user.fullName}</h1>
          <p className="muted small">
            @{user.username}
            {user.school ? ` · ${user.school}` : ''}
          </p>
        </div>
        {!p.me && (
          <FollowButton userId={user.id} initial={p.following} onChange={(f) => setFollowers((n) => n + (f ? 1 : -1))} />
        )}
      </header>
      {user.bio && <p className="person__bio">{user.bio}</p>}
      <div className="stats">
        <div>
          <strong>{p.posts.length}</strong>
          <span className="label label--muted">posts</span>
        </div>
        <div>
          <strong>{followers}</strong>
          <span className="label label--muted">followers</span>
        </div>
        <div>
          <strong>{p.followingCount}</strong>
          <span className="label label--muted">following</span>
        </div>
      </div>
      {p.sharedCrews.length > 0 && (
        <p className="small">
          <span className="muted">Crews together:</span>{' '}
          {p.sharedCrews.map((c, i) => (
            <span key={c.id}>
              {i > 0 && ', '}
              <Link to={`/groups/${c.id}`}>{c.name}</Link>
            </span>
          ))}
        </p>
      )}
      <h2 className="label section-label">Their line</h2>
      {p.posts.length === 0 ? (
        <p className="small muted">No posts yet.</p>
      ) : (
        <ul className="feed">
          {p.posts.map((post) => (
            <li key={post.id} className="post post--compact">
              <div className="post__body">
                <div className="post__place">
                  <TypeTag type={post.place.type} />
                  <strong className="post__name">{post.place.name}</strong>
                  <span className="small muted">
                    <Stars value={post.rating} size={12} /> · {timeAgo(post.createdAt)}
                  </span>
                </div>
                {post.caption && <p className="post__caption">{post.caption}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
