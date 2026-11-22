import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Chip } from '../components/Chip';
import { RefreshIcon } from '../components/Icons';
import { Sheet } from '../components/Sheet';
import { SuggestionCard } from '../components/SuggestionCard';
import { TopBar } from '../components/TopBar';
import { Fork, TrainLoader } from '../components/Transit';
import { TYPE_COLORS } from '../config';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useRecSession } from '../lib/session';
import type { Plan, RecFeedback } from '../lib/types';
import { windowLabel } from '../lib/util';

/** Two options, A or B. Regenerating opens the feedback sheet. */
export default function Results() {
  const session = useRecSession();
  const { meta } = useAuth();
  const navigate = useNavigate();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [choosing, setChoosing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!session.request) return <Navigate to="/discover" replace />;
  const req = session.request;

  async function choose(placeId: string) {
    setChoosing(placeId);
    setError(null);
    try {
      const plan = await api<Plan>('/plans', { body: { placeId, request: req } });
      navigate(`/plan/${plan.id}`);
    } catch (e) {
      setError((e as Error).message);
      setChoosing(null);
    }
  }

  async function regenerate(fb?: RecFeedback) {
    setFeedbackOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    await session.regenerate(fb);
  }

  const [a, b] = session.suggestions;
  const hood = req.location === 'anywhere' ? 'Anywhere' : meta?.neighborhoods.find((n) => n.id === req.location)?.label;
  const typeLabel = meta?.types.find((t) => t.id === req.type)?.label;
  const color = TYPE_COLORS[req.type];
  const span = windowLabel(req.startAt ? new Date(req.startAt) : new Date(), req.durationMinutes ?? 120);
  const none = !session.loading && !a;

  return (
    <div className="screen">
      <TopBar back="/discover" title={<span className="label label--muted">Round {session.round}</span>} />
      <p className="label">
        {req.groupId ? 'For your crew' : 'For you'} · {typeLabel} · {hood} · {span}
        {session.budget && session.budget !== req.price && <> · max {meta?.priceTiers.find((t) => t.id === session.budget)?.label}</>}
      </p>
      <h1 className="title">{none ? 'Nothing fits. Yet.' : b ? 'Your next stop.' : 'One good option.'}</h1>
      {!none && (
        <>
          <p className="lede">{b ? "A or B. That's the whole decision." : 'Only one thing fits that window around here.'}</p>
          <Fork colorA={color} colorB={b ? color : '#e5e5e2'} />
        </>
      )}

      {session.exhausted && <p className="notice">You've seen everything that fits, so here are a couple again. Loosen a filter for fresh picks.</p>}
      {error && <p className="error">{error}</p>}

      {session.loading ? (
        <TrainLoader />
      ) : (
        <div className="results" key={session.round}>
          {a && <SuggestionCard letter="A" suggestion={a} busy={choosing === a.place.id} onChoose={() => choose(a.place.id)} />}
          {b && (
            <>
              <div className="or" aria-hidden>
                <span>or</span>
              </div>
              <SuggestionCard letter="B" suggestion={b} busy={choosing === b.place.id} onChoose={() => choose(b.place.id)} />
            </>
          )}
          {none && (
            <div className="empty-state">
              <p>
                {req.type === 'event'
                  ? `No events start in ${hood} or right next door between ${span}.`
                  : `Nothing in ${hood} or right next door fits ${span}.`}
              </p>
              <p className="muted small">We only suggest things nearby you can actually catch. Try a later start, more time, or another neighborhood.</p>
              <Link to="/discover" className="btn btn--primary">
                Change the plan
              </Link>
            </div>
          )}
        </div>
      )}

      {!none && (
        <button type="button" className="btn btn--ghost btn--block reroll" onClick={() => setFeedbackOpen(true)} disabled={session.loading}>
          <RefreshIcon size={18} /> {b ? 'Neither. Show me two more' : 'Not this. Show me another'}
        </button>
      )}

      <FeedbackSheet open={feedbackOpen} onClose={() => setFeedbackOpen(false)} onSubmit={regenerate} />
    </div>
  );
}

/** The "feedback screen": one optional nudge to make the next round better */
function FeedbackSheet({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (fb?: RecFeedback) => void }) {
  const { meta } = useAuth();
  const { request } = useRecSession();
  const [tags, setTags] = useState<string[]>([]);
  const [cheaper, setCheaper] = useState(false);
  const [closer, setCloser] = useState(false);
  const [different, setDifferent] = useState(false);
  if (!request || !meta) return null;

  const prompts = { food: 'Craving anything?', event: 'What kind of event?', activity: 'What sounds fun?' };
  const toggle = (t: string) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  const reset = () => {
    setTags([]);
    setCheaper(false);
    setCloser(false);
    setDifferent(false);
  };
  const any = tags.length || cheaper || closer || different;

  return (
    <Sheet open={open} onClose={onClose} label="Tell us more">
      <p className="label">Optional</p>
      <h2 className="title title--sm">Not feeling those?</h2>
      <h3 className="label sheet__label">{prompts[request.type]}</h3>
      <div className="chips">
        {meta.preferenceTags[request.type].map((t) => (
          <Chip key={t} selected={tags.includes(t)} onClick={() => toggle(t)}>
            {t}
          </Chip>
        ))}
      </div>
      <h3 className="label sheet__label">Or</h3>
      <div className="chips">
        <Chip selected={cheaper} onClick={() => setCheaper(!cheaper)}>
          Cheaper
        </Chip>
        {request.location !== 'anywhere' && (
          <Chip selected={closer} onClick={() => setCloser(!closer)}>
            Closer
          </Chip>
        )}
        <Chip selected={different} onClick={() => setDifferent(!different)}>
          Totally different
        </Chip>
      </div>
      <button
        type="button"
        className="btn btn--primary btn--block btn--lg sheet__go"
        onClick={() => {
          onSubmit(any ? { moreTags: tags, cheaper, closer, different } : undefined);
          reset();
        }}
      >
        {any ? 'Show me two more' : 'Just shuffle'}
      </button>
    </Sheet>
  );
}
