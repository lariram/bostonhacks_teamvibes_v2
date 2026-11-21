import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { BookmarkIcon, HeartIcon, UsersIcon } from '../components/Icons';
import { PlaceBadge } from '../components/PlaceBadge';
import { Stars } from '../components/Stars';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { FeedPost } from '../lib/types';
import { timeAgo } from '../lib/util';

export default function Feed() {
  const { meta } = useAuth();
  const [posts, setPosts] = useState<FeedPost[] | null>(null);

  useEffect(() => {
    api<FeedPost[]>('/feed').then(setPosts);
  }, []);

  async function react(post: FeedPost, kind: 'like' | 'want') {
    const r = await api<{ likes: number; likedByMe: boolean; wantedByMe: boolean }>(`/feed/${post.id}/react`, { body: { kind } });
    // "want" is per place, so update every post about the same spot
    setPosts((ps) =>
      ps?.map((p) =>
        p.id === post.id ? { ...p, ...r } : p.place.id === post.place.id ? { ...p, wantedByMe: r.wantedByMe } : p,
      ) ?? null,
    );
  }

  return (
    <div className="screen">
      <h1 className="title">Feed</h1>
      <p className="lede">What Bostonians are getting up to. Save a spot and we'll work it into your picks.</p>
      {!posts && <p className="muted center">Loading…</p>}
      {posts?.length === 0 && <p className="notice">Nothing here yet. Be the first to post!</p>}
      <ul className="feed">
        {posts?.map((p) => (
          <li key={p.id} className="post">
            <header className="post__head">
              {p.user && <Avatar user={p.user} size={40} />}
              <div>
                <strong>{p.mine ? 'You' : p.user?.firstName}</strong>
                <span className="muted small"> · {timeAgo(p.createdAt)}</span>
                <p className="small muted">{p.user?.school}</p>
              </div>
            </header>
            <div className="post__place">
              <PlaceBadge place={p.place} size={48} />
              <div>
                <strong>{p.place.name}</strong>
                <p className="small muted">{meta?.neighborhoods.find((n) => n.id === p.place.neighborhood)?.label}</p>
                <Stars value={p.rating} size={15} />
              </div>
            </div>
            {p.caption && <p className="post__caption">{p.caption}</p>}
            {p.group && (
              <p className="post__group small">
                <UsersIcon size={14} /> with {p.group.name} · {p.group.size}
              </p>
            )}
            <footer className="post__actions">
              <button type="button" className={p.likedByMe ? 'on like' : 'like'} onClick={() => react(p, 'like')} aria-pressed={p.likedByMe}>
                <HeartIcon size={20} filled={p.likedByMe} /> {p.likes || ''}
              </button>
              {!p.mine && (
                <button type="button" className={p.wantedByMe ? 'on want' : 'want'} onClick={() => react(p, 'want')} aria-pressed={p.wantedByMe}>
                  <BookmarkIcon size={20} filled={p.wantedByMe} /> {p.wantedByMe ? 'Saved' : 'Want to go'}
                </button>
              )}
            </footer>
          </li>
        ))}
      </ul>
      <p className="center small muted">
        <Link to="/discover">Find your next thing →</Link>
      </p>
    </div>
  );
}
