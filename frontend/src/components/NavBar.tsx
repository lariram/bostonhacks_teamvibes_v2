import { NavLink } from 'react-router-dom';
import { DiscoverIcon, FeedIcon, HistoryIcon, ProfileIcon } from './Icons';

const items = [
  { to: '/feed', label: 'Feed', Icon: FeedIcon },
  { to: '/discover', label: 'Discover', Icon: DiscoverIcon },
  { to: '/history', label: 'History', Icon: HistoryIcon },
  { to: '/profile', label: 'Profile', Icon: ProfileIcon },
];

export function NavBar() {
  return (
    <nav className="navbar" aria-label="Main">
      {items.map(({ to, label, Icon }) => (
        <NavLink key={to} to={to} className={({ isActive }) => `navbar__item${isActive ? ' active' : ''}`}>
          <Icon size={28} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
