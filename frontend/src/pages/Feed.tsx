import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { FollowButton } from '../components/FollowButton';
import { BookmarkIcon, HeartIcon } from '../components/Icons';
import { TypeTag } from '../components/PlaceBadge';
import { Stars } from '../components/Stars';
import { PlacePhoto } from '../components/PlacePhoto';
import { LineDot } from '../components/Transit';
import { crewLine } from '../config';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { FeedPost, PublicUser } from '../lib/types';
import { timeAgo } from '../lib/util';

type Scope = 'following' | 'everyone';

export default function Feed() {
  const { meta } = useAuth();
  const [scope, setScope] = useState<Scope>('following');
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [suggested, setSuggested] = useState<{ user: PublicUser; why: string }[]>([]);

  const load = useCallback((s: Scope) => {
    setPosts(null);
    api<FeedPost[]>(`/feed?scope=${s}`).then(setPosts);
  }, []);
  useEffect(() => load(scope), [scope, load]);
  useEffect(() => {
    api<{ user: PublicUser; why: string }[]>('/people/suggested').then(setSuggested);
  }, []);

  async function react(post: FeedPost, kind: 'like' | 'want') {
    const r = await api<{ likes: number; likedByMe: boolean; wantedByMe: boolean }>(`/feed/${post.id}/react`, { body: { kind } });
    // "want" is per place, so update every post about the same spot
    setPosts(
      (ps) => ps?.map((p) => (p.id === post.id ? { ...p, ...r } : p.place.id === post.place.id ? { ...p, wantedByMe: r.wantedByMe } : p)) ?? null,
    );
  }

  const followingNoOne = scope === 'following' && posts !== null && posts.every((p) => p.mine);

  return (
    <div className="screen">
      <p className="label">Around Boston</p>
      <h1 className="title">Feed</h1>
      <div className="tabs feed-tabs" role="tablist">
        <button role="tab" aria-selected={scope === 'following'} className={scope === 'following' ? 'on' : ''} onClick={() => setScope('following')}>
          Following
        </button>
        <button role="tab" aria-selected={scope === 'everyone'} className={scope === 'everyone' ? 'on' : ''} onClick={() => setScope('everyone')}>
          Everyone
        </button>
      </div>
      <p className="lede small">Save a spot and it shows up on My line and in your picks.</p>

      {!posts && <p className="muted center">Loading…</p>}

      {followingNoOne && (
        <section className="who-to-follow">
          <h2 className="label">Follow people to fill your feed</h2>
          <p className="small muted">People from your groups, and people whose outings look like yours.</p>
          <ul>
            {suggested.map(({ user, why }) => (
              <li key={user.id}>
                <Link to={`/people/${user.id}`} className="person-link">
                  <Avatar user={user} size={36} />
                  <div>
                    <strong>{user.firstName}</strong>
                    <p className="tiny muted">
                      {user.school} · {why}
                    </p>
                  </div>
                </Link>
                <FollowButton userId={user.id} initial={false} onChange={() => load('following')} />
              </li>
            ))}
          </ul>
          <button type="button" className="link small" onClick={() => setScope('everyone')}>
            See what everyone's up to →
          </button>
        </section>
      )}

      <ul className="feed">
        {posts?.map((p) => (
          <li key={p.id} className="post">
            {p.user && (
              <Link to={p.mine ? '/profile' : `/people/${p.user.id}`} aria-label={p.user.firstName}>
                <Avatar user={p.user} size={36} />
              </Link>
            )}
            <div className="post__body">
              <p className="post__who">
                <Link to={p.mine ? '/profile' : `/people/${p.user?.id}`} className="post__name-link">
                  <strong>{p.mine ? 'You' : p.user?.firstName}</strong>
                </Link>
                <span className="muted"> · {p.user?.school ?? ''}</span>
                <span className="muted post__time">{timeAgo(p.createdAt)}</span>
              </p>
              {!p.mine && !p.following && scope === 'everyone' && p.user && (
                <div className="post__follow">
                  <FollowButton userId={p.user.id} initial={false} />
                </div>
              )}
              <div className="post__place post__place--photo">
                <PlacePhoto place={p.place} variant="thumb" />
                <div className="post__place-text">
                <TypeTag type={p.place.type}>
                  {meta?.neighborhoods.find((n) => n.id === p.place.neighborhood)?.label ?? p.place.live?.area ?? 'Greater Boston'}
                </TypeTag>
                <strong className="post__name">{p.place.name}</strong>
                <Stars value={p.rating} size={13} />
                </div>
              </div>
              {p.caption && <p className="post__caption">{p.caption}</p>}
              {p.group && (
                <p className="post__group small">
                  <LineDot line={crewLine(p.group.id)} size={8} /> with {p.group.name} · {p.group.size}
                </p>
              )}
              <div className="post__actions">
                <button type="button" className={p.likedByMe ? 'on like' : 'like'} onClick={() => react(p, 'like')} aria-pressed={p.likedByMe} aria-label="Like">
                  <HeartIcon size={19} filled={p.likedByMe} /> {p.likes || ''}
                </button>
                {!p.mine && (
                  <button type="button" className={p.wantedByMe ? 'on want' : 'want'} onClick={() => react(p, 'want')} aria-pressed={p.wantedByMe}>
                    <BookmarkIcon size={19} filled={p.wantedByMe} /> {p.wantedByMe ? 'Saved to My line' : 'Save'}
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <p className="center small">
        <Link to="/discover">Find your next stop →</Link>
      </p>
    </div>
  );
}
