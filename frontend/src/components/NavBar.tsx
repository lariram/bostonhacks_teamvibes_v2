import type { CSSProperties } from 'react';
import { NavLink } from 'react-router-dom';
import { LINES } from '../config';
import { DiscoverIcon, FeedIcon, HistoryIcon, ProfileIcon } from './Icons';

const items = [
  // each tab rides its own line color when selected
  { to: '/feed', label: 'Feed', Icon: FeedIcon, color: LINES.blue },
  { to: '/discover', label: 'Discover', Icon: DiscoverIcon, color: LINES.red },
  { to: '/history', label: 'My line', Icon: HistoryIcon, color: LINES.orange },
  { to: '/profile', label: 'Profile', Icon: ProfileIcon, color: LINES.green },
];

export function NavBar() {
  return (
    <nav className="navbar" aria-label="Main">
      {items.map(({ to, label, Icon, color }) => (
        <NavLink key={to} to={to} style={{ '--nav-color': color } as CSSProperties} className={({ isActive }) => `navbar__item${isActive ? ' active' : ''}`}>
          <Icon size={26} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
