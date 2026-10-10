import { NavLink } from 'react-router-dom';
import { BrowseIcon, HomeIcon, ProfileIcon, ScoresIcon, HeartIcon } from './icons';

const TABS = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  { to: '/#all-games', label: 'Browse', icon: BrowseIcon },
  { to: '/leaderboards', label: 'Scores', icon: ScoresIcon },
  { to: '/favorites', label: 'Saved', icon: HeartIcon },
];

export function TabBar() {
  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink-2 pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="mx-auto flex max-w-md justify-around">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <li key={label}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 px-3 py-2.5 text-[11px] font-medium ${isActive && !to.includes('#') ? 'text-gold' : 'text-muted'}`
              }
            >
              <Icon width={22} height={22} />
              {label}
            </NavLink>
          </li>
        ))}
        <li>
          <NavLink to="/settings" className={({ isActive }) => `flex flex-col items-center gap-1 px-3 py-2.5 text-[11px] font-medium ${isActive ? 'text-gold' : 'text-muted'}`}>
            <ProfileIcon width={22} height={22} />
            Profile
          </NavLink>
        </li>
      </ul>
    </nav>
  );
}
