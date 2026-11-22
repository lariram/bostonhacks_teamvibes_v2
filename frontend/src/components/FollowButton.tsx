import { useState } from 'react';
import { api } from '../lib/api';

/** Follow / Following toggle for a person */
export function FollowButton({ userId, initial, onChange }: { userId: string; initial: boolean; onChange?: (f: boolean) => void }) {
  const [following, setFollowing] = useState(initial);
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={`follow-btn${following ? ' on' : ''}`}
      aria-pressed={following}
      disabled={busy}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setBusy(true);
        try {
          const r = await api<{ following: boolean }>(`/users/${userId}/follow`, { method: 'POST' });
          setFollowing(r.following);
          onChange?.(r.following);
        } finally {
          setBusy(false);
        }
      }}
    >
      {following ? 'Following' : 'Follow'}
    </button>
  );
}
