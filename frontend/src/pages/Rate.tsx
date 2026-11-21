import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LockIcon } from '../components/Icons';
import { PlaceBadge } from '../components/PlaceBadge';
import { StarInput } from '../components/Stars';
import { TopBar } from '../components/TopBar';
import { api } from '../lib/api';
import type { Plan } from '../lib/types';

/** Star rating + private review + optional public post */
export default function Rate() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [post, setPost] = useState(true);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Plan>(`/plans/${id}`).then((p) => {
      setPlan(p);
      if (p.rating) setRating(p.rating);
      if (p.review) setReview(p.review);
    });
  }, [id]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api(`/plans/${id}/complete`, { body: { rating, review: review.trim() || undefined, postToFeed: post, caption: caption.trim() || undefined } });
      navigate(`/plan/${id}/next`, { replace: true });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  if (!plan) return <div className="screen center muted">Loading…</div>;

  return (
    <div className="screen with-footer">
      <TopBar back={`/plan/${id}`} />
      <div className="rate__head">
        <PlaceBadge place={plan.place} size={72} />
        <h1 className="title title--sm">How was {plan.place.name}?</h1>
      </div>

      <StarInput value={rating} onChange={setRating} />

      <label className="field">
        <span className="field__label">
          <LockIcon size={14} /> Private review <span className="muted">(just for your records)</span>
        </span>
        <textarea className="input textarea" rows={4} placeholder="What stood out? Would you go back?" value={review} onChange={(e) => setReview(e.target.value)} />
      </label>

      <div className={`toggle-card${post ? ' on' : ''}`}>
        <label className="switch">
          <input type="checkbox" checked={post} onChange={(e) => setPost(e.target.checked)} />
          <span className="switch__track" />
          <span>
            <strong>Post to the public feed</strong>
            <span className="small muted block">Shares the spot and your stars. Your review stays private.</span>
          </span>
        </label>
        {post && (
          <input className="input" placeholder="Add a caption (optional)" maxLength={280} value={caption} onChange={(e) => setCaption(e.target.value)} />
        )}
      </div>

      {error && <p className="error">{error}</p>}
      <footer className="footer-bar">
        <button type="button" className="btn btn--primary btn--block btn--lg" disabled={!rating || busy} onClick={submit}>
          {busy ? 'Saving…' : rating ? 'Save' : 'Tap a star to rate'}
        </button>
      </footer>
    </div>
  );
}
