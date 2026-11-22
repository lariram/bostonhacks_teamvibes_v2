import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { Wordmark } from '../components/Wordmark';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

const FIELDS = [
  { key: 'fullName', label: 'Full name', autoComplete: 'name' },
  { key: 'age', label: 'Age', inputMode: 'numeric' as const },
  { key: 'username', label: 'Public username', autoComplete: 'username' },
  { key: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
  { key: 'password', label: 'Password', type: 'password', autoComplete: 'new-password' },
  { key: 'confirm', label: 'Confirm password', type: 'password', autoComplete: 'new-password' },
] as const;

export default function Signup() {
  const { signIn } = useAuth();
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirm) return setError("Passwords don't match");
    setBusy(true);
    setError(null);
    try {
      const { token } = await api<{ token: string }>('/auth/signup', { body: { ...form, age: Number(form.age) } });
      await signIn(token, '/onboarding'); // the public-route guard sends us there
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="screen auth">
      <TopBar back="/" />
      <Wordmark size={36} />
      <h1 className="title">Get your pass.</h1>
      <form className="form" onSubmit={submit}>
        {FIELDS.map((f) => (
          <label key={f.key} className="field">
            <span className="label">{f.label}</span>
            <input
              className="input"
              type={'type' in f ? f.type : 'text'}
              inputMode={'inputMode' in f ? f.inputMode : undefined}
              autoComplete={'autoComplete' in f ? f.autoComplete : undefined}
              value={form[f.key] ?? ''}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              required
            />
          </label>
        ))}
        {error && <p className="error">{error}</p>}
        <button className="btn btn--primary btn--lg btn--block" disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </button>
        <p className="muted small center">
          18+ to join crews. Have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}
