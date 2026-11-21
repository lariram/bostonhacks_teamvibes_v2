import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { Wordmark } from '../components/Wordmark';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function Signup() {
  const { signIn } = useAuth();
  const [form, setForm] = useState({ fullName: '', age: '', username: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirm) return setError("Passwords don't match");
    setBusy(true);
    setError(null);
    try {
      const { token } = await api<{ token: string }>('/auth/signup', {
        body: { ...form, age: Number(form.age) },
      });
      await signIn(token, '/onboarding'); // the public-route guard sends us there
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
        <input className="input" placeholder="Full Name" autoComplete="name" value={form.fullName} onChange={set('fullName')} required />
        <input className="input" placeholder="Age" inputMode="numeric" value={form.age} onChange={set('age')} required />
        <div className="form__gap" />
        <input className="input" placeholder="Public username" autoComplete="username" value={form.username} onChange={set('username')} required />
        <input className="input" type="email" placeholder="Email Address" autoComplete="email" value={form.email} onChange={set('email')} required />
        <input className="input" type="password" placeholder="Password" autoComplete="new-password" value={form.password} onChange={set('password')} required />
        <input className="input" type="password" placeholder="Confirm Password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} required />
        {error && <p className="error">{error}</p>}
        <button className="btn btn--primary btn--lg" disabled={busy}>
          {busy ? 'Creating…' : 'Create Account'}
        </button>
        <p className="muted center small">
          You need to be 18+ to join group meetups. Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}
