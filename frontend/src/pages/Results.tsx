import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Chip } from '../components/Chip';
import { RefreshIcon } from '../components/Icons';
import { Sheet } from '../components/Sheet';
import { SuggestionCard } from '../components/SuggestionCard';
import { TopBar } from '../components/TopBar';
import { TYPE_COLORS } from '../config';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useRecSession } from '../lib/session';
import type { Plan, RecFeedback } from '../lib/types';

/** "Pick one!": two suggestions, or generate new ones */
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
    await session.regenerate(fb);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const [a, b] = session.suggestions;
  const hood = req.location === 'anywhere' ? 'anywhere in Boston' : meta?.neighborhoods.find((n) => n.id === req.location)?.label;
  const typeLabel = meta?.types.find((t) => t.id === req.type)?.label.toLowerCase();

  return (
    <div className="screen">
      <TopBar back="/discover" title={<span className="small muted">Round {session.round}</span>} />
      <h1 className="title">Pick one!</h1>
      <p className="lede">
        {req.groupId ? 'For your crew' : 'For you'}: {typeLabel} · {hood}
        {session.budget && session.budget !== req.price && (
          <> · budget {meta?.priceTiers.find((t) => t.id === session.budget)?.label}</>
        )}
      </p>
      {session.exhausted && (
        <p className="notice">You've seen everything that fits. Here are a couple again. Try loosening a filter for new picks.</p>
      )}
      {error && <p className="error">{error}</p>}

      <div className={`results${session.loading ? ' is-loading' : ''}`}>
        {a && <SuggestionCard key={a.place.id} index={0} suggestion={a} busy={choosing === a.place.id} onChoose={() => choose(a.place.id)} />}
        {b && (
          <>
            <div className="or">or</div>
            <SuggestionCard key={b.place.id} index={1} suggestion={b} busy={choosing === b.place.id} onChoose={() => choose(b.place.id)} />
          </>
        )}
        {!a && !session.loading && (
          <p className="notice">
            Nothing matched those filters. <Link to="/discover">Try a different combo</Link>.
          </p>
        )}
        <div className="or">or</div>
        <button type="button" className="btn btn--ghost btn--block btn--lg" onClick={() => setFeedbackOpen(true)} disabled={session.loading}>
          <RefreshIcon size={20} />
          {session.loading ? 'Thinking…' : 'Generate new recommendations'}
        </button>
      </div>

      <FeedbackSheet open={feedbackOpen} onClose={() => setFeedbackOpen(false)} onSubmit={regenerate} />
    </div>
  );
}

/** The "feedback screen": asks for more detail to make the next round better */
function FeedbackSheet({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (fb?: RecFeedback) => void }) {
  const { meta } = useAuth();
  const { request } = useRecSession();
  const [tags, setTags] = useState<string[]>([]);
  const [cheaper, setCheaper] = useState(false);
  const [closer, setCloser] = useState(false);
  const [different, setDifferent] = useState(false);
  if (!request || !meta) return null;

  const prompts = { food: 'What are you craving?', event: 'What kind of event?', activity: 'What sounds fun?' };
  const toggle = (t: string) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  const submit = () => {
    onSubmit({ moreTags: tags, cheaper, closer, different });
    setTags([]);
    setCheaper(false);
    setCloser(false);
    setDifferent(false);
  };

  return (
    <Sheet open={open} onClose={onClose} label="Tell us more">
      <h2 className="title title--sm">Not quite right?</h2>
      <p className="lede">Tell us a little more and we'll do better. Totally optional.</p>
      <h3 className="subhead">{prompts[request.type]}</h3>
      <div className="chips">
        {meta.preferenceTags[request.type].map((t) => (
          <Chip key={t} selected={tags.includes(t)} color={TYPE_COLORS[request.type]} onClick={() => toggle(t)}>
            {t}
          </Chip>
        ))}
      </div>
      <h3 className="subhead">Anything else?</h3>
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
          Something totally different
        </Chip>
      </div>
      <div className="sheet__actions">
        <button type="button" className="btn btn--ghost" onClick={() => onSubmit()}>
          Just shuffle
        </button>
        <button type="button" className="btn btn--primary" onClick={submit}>
          Show me new picks
        </button>
      </div>
    </Sheet>
  );
}
