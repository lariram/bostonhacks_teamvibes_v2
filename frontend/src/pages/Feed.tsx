import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { BookmarkIcon, HeartIcon } from '../components/Icons';
import { TypeTag } from '../components/PlaceBadge';
import { Stars } from '../components/Stars';
import { LineDot } from '../components/Transit';
import { crewLine } from '../config';
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
    setPosts(
      (ps) =>
        ps?.map((p) => (p.id === post.id ? { ...p, ...r } : p.place.id === post.place.id ? { ...p, wantedByMe: r.wantedByMe } : p)) ?? null,
    );
  }

  return (
    <div className="screen">
      <p className="label">Around Boston</p>
      <h1 className="title">Feed</h1>
      <p className="lede">Where people went. Save a spot and it shows up in your picks.</p>
      {!posts && <p className="muted center">Loading…</p>}
      {posts?.length === 0 && <p className="notice">Nothing yet. Be the first to post!</p>}
      <ul className="feed">
        {posts?.map((p) => (
          <li key={p.id} className="post">
            {p.user && <Avatar user={p.user} size={36} />}
            <div className="post__body">
              <p className="post__who">
                <strong>{p.mine ? 'You' : p.user?.firstName}</strong>
                <span className="muted"> · {p.user?.school ?? ''}</span>
                <span className="muted post__time">{timeAgo(p.createdAt)}</span>
              </p>
              <div className="post__place">
                <TypeTag type={p.place.type}>{meta?.neighborhoods.find((n) => n.id === p.place.neighborhood)?.label ?? p.place.live?.area ?? 'Greater Boston'}</TypeTag>
                <strong className="post__name">{p.place.name}</strong>
                <Stars value={p.rating} size={13} />
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
                    <BookmarkIcon size={19} filled={p.wantedByMe} /> {p.wantedByMe ? 'Saved' : 'Want to go'}
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <p className="center small">
        <Link to="/discover">
          Find your next stop →
        </Link>
      </p>
    </div>
  );
}
