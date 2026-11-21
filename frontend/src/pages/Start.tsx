import { Link } from 'react-router-dom';
import { Wordmark } from '../components/Wordmark';
import { COLORS, TAGLINE } from '../config';

export default function Start() {
  return (
    <div className="screen start">
      <div className="start__swatches" aria-hidden>
        {[COLORS.red, COLORS.navy, COLORS.green, COLORS.silver, COLORS.purple, COLORS.orange].map((c) => (
          <span key={c} style={{ background: c }} />
        ))}
      </div>
      <div className="start__hero">
        <Wordmark size={56} />
        <p className="start__tagline">{TAGLINE}</p>
        <p className="start__pitch">
          Tell us where you are, what you're into and what you want to spend. We'll give you two great things to do,
          and a crew of Bostonians to do them with.
        </p>
      </div>
      <div className="start__actions">
        <Link to="/login" className="btn btn--ghost btn--lg">
          Log In
        </Link>
        <Link to="/signup" className="btn btn--primary btn--lg">
          Create Account
        </Link>
      </div>
    </div>
  );
}
