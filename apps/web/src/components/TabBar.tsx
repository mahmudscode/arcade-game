import { NavLink } from 'react-router-dom';
import { useT, type Key } from '../lib/i18n';
import { BrowseIcon, HomeIcon, ProfileIcon, ScoresIcon, HeartIcon } from './icons';

const TABS: { to: string; key: Key; icon: typeof HomeIcon; end?: boolean }[] = [
  { to: '/', key: 'tab.home', icon: HomeIcon, end: true },
  { to: '/#all-games', key: 'tab.browse', icon: BrowseIcon },
  { to: '/leaderboards', key: 'tab.scores', icon: ScoresIcon },
  { to: '/favorites', key: 'tab.saved', icon: HeartIcon },
];

export function TabBar() {
  const t = useT();
  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink-2 pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="mx-auto flex max-w-md justify-around">
        {TABS.map(({ to, key, icon: Icon, end }) => (
          <li key={key}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 px-3 py-2.5 text-[11px] font-medium ${isActive && !to.includes('#') ? 'text-gold' : 'text-muted'}`
              }
            >
              <Icon width={22} height={22} />
              {t(key)}
            </NavLink>
          </li>
        ))}
        <li>
          <NavLink to="/profile" className={({ isActive }) => `flex flex-col items-center gap-1 px-3 py-2.5 text-[11px] font-medium ${isActive ? 'text-gold' : 'text-muted'}`}>
            <ProfileIcon width={22} height={22} />
            Profile
          </NavLink>
        </li>
      </ul>
    </nav>
  );
}
