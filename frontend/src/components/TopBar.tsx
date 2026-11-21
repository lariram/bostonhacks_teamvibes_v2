import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackIcon } from './Icons';

export function TopBar({ title, back, right }: { title?: ReactNode; back?: string | true; right?: ReactNode }) {
  const navigate = useNavigate();
  return (
    <header className="topbar">
      {back ? (
        <button
          type="button"
          className="icon-btn"
          aria-label="Back"
          onClick={() => (back === true ? navigate(-1) : navigate(back))}
        >
          <BackIcon />
        </button>
      ) : (
        <span className="topbar__spacer" />
      )}
      <div className="topbar__title">{title}</div>
      {right ?? <span className="topbar__spacer" />}
    </header>
  );
}
