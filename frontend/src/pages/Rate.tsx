import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LockIcon } from '../components/Icons';
import { TypeTag } from '../components/PlaceBadge';
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
  const [share, setShare] = useState<'now' | 'later' | 'private'>('now');
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
      await api(`/plans/${id}/complete`, {
        body: { rating, review: review.trim() || undefined, shareMode: share, caption: share === 'now' ? caption.trim() || undefined : undefined },
      });
      navigate(`/plan/${id}/next`, { replace: true });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  if (!plan) return <div className="screen center muted">Loading…</div>;

  return (
    <div className="screen with-footer rate">
      <TopBar back={`/plan/${id}`} />
      <TypeTag type={plan.place.type}>{plan.neighborhoodLabel}</TypeTag>
      <h1 className="title">How was {plan.place.name}?</h1>

      <StarInput value={rating} onChange={setRating} />

      <label className="field">
        <span className="label">
          <LockIcon size={12} /> Private notes · only you see these
        </span>
        <textarea className="input textarea" rows={3} placeholder="What stood out? Would you go back?" value={review} onChange={(e) => setReview(e.target.value)} />
      </label>

      <section className="share-choice">
        <h2 className="label">Share it?</h2>
        <div className="share-choice__options" role="radiogroup" aria-label="Share it?">
          {(
            [
              ['now', 'Post now', 'This stop and your stars go on the feed.'],
              ['later', 'Add to my day post', 'Saved for one post of your whole day, when you\'re done.'],
              ['private', 'Keep private', 'Only you see it, on My line.'],
            ] as const
          ).map(([id, title, hint]) => (
            <button key={id} type="button" role="radio" aria-checked={share === id} className={`share-choice__opt${share === id ? ' on' : ''}`} onClick={() => setShare(id)}>
              <span className="share-choice__dot" aria-hidden />
              <span>
                <strong>{title}</strong>
                <span className="small muted block">{hint}</span>
              </span>
            </button>
          ))}
        </div>
        {share === 'now' && <input className="input" placeholder="Caption (optional)" maxLength={280} value={caption} onChange={(e) => setCaption(e.target.value)} />}
        <p className="tiny muted">Your private notes are never shared.</p>
      </section>

      {error && <p className="error">{error}</p>}
      <footer className="footer-bar">
        <button type="button" className="btn btn--primary btn--block btn--lg" disabled={!rating || busy} onClick={submit}>
          {busy ? 'Saving…' : rating ? 'Save' : 'Tap a star'}
        </button>
      </footer>
    </div>
  );
}
