import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowIcon } from '../components/Icons';
import { BrandMark } from '../components/Transit';
import { Wordmark } from '../components/Wordmark';
import { BRAND_STORY, TAGLINE } from '../config';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function Start() {
  const { signIn } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guest(demo = false) {
    setBusy(true);
    setError(null);
    try {
      const { token } = await api<{ token: string }>(demo ? '/auth/demo' : '/auth/guest', { method: 'POST' });
      // the demo account is already set up, so skip onboarding
      await signIn(token, demo ? '/profile' : '/onboarding');
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="screen start">
      <div className="start__hero">
        <BrandMark dark width="100%" />
        <Wordmark size={64} light />
        <p className="start__tagline">{TAGLINE}</p>
      </div>
      <div className="start__actions">
        <button type="button" className="btn btn--light btn--lg btn--block" onClick={() => guest()} disabled={busy}>
          {busy ? 'Boarding…' : 'Try it as a guest'} <ArrowIcon size={20} />
        </button>
        <button type="button" className="btn btn--outline-light btn--lg btn--block" onClick={() => guest(true)} disabled={busy}>
          See a demo account
        </button>
        <Link to="/signup" className="btn btn--outline-light btn--lg btn--block">
          Create account
        </Link>
        <Link to="/login" className="start__login">
          Have an account? <strong>Log in</strong>
        </Link>
        {error && <p className="error">{error}</p>}
        <p className="start__story">{BRAND_STORY}</p>
      </div>
    </div>
  );
}
