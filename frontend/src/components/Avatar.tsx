import { initials } from '../lib/util';
import type { PublicUser } from '../lib/types';

export function Avatar({ user, size = 40 }: { user: Pick<PublicUser, 'fullName' | 'avatarColor'>; size?: number }) {
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, background: user.avatarColor, fontSize: size * 0.38 }}
      aria-hidden
    >
      {initials(user.fullName)}
    </span>
  );
}

export function AvatarStack({ users, size = 32, max = 5 }: { users: PublicUser[]; size?: number; max?: number }) {
  const shown = users.slice(0, max);
  return (
    <span className="avatar-stack" aria-label={users.map((u) => u.firstName).join(', ')}>
      {shown.map((u) => (
        <Avatar key={u.id} user={u} size={size} />
      ))}
      {users.length > max && (
        <span className="avatar avatar--more" style={{ width: size, height: size, fontSize: size * 0.34 }}>
          +{users.length - max}
        </span>
      )}
    </span>
  );
}
