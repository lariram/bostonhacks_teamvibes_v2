import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { Wordmark } from '../components/Wordmark';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { token } = await api<{ token: string }>('/auth/login', { body: { email, password } });
      await signIn(token, '/discover');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen auth">
      <TopBar back="/" />
      <div className="auth__brand">
        <Wordmark />
      </div>
      <form className="form" onSubmit={submit}>
        <input className="input" type="email" placeholder="Email Address" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="input" type="password" placeholder="Password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="error">{error}</p>}
        <button className="btn btn--primary btn--lg" disabled={busy}>
          {busy ? 'Logging in…' : 'Log In'}
        </button>
        <p className="muted center">
          New here? <Link to="/signup">Create an account</Link>
        </p>
      </form>
    </div>
  );
}
