import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { GAMES } from '@arcade/shared';
import { useAuth } from '../lib/auth';
import { useT, type Key } from '../lib/i18n';
import { Logo } from './Logo';
import { SearchIcon } from './icons';

const NAV: { to: string; key: Key; end?: boolean }[] = [
  { to: '/', key: 'nav.games', end: true },
  { to: '/#categories', key: 'nav.categories' },
  { to: '/leaderboards', key: 'nav.leaderboards' },
  { to: '/favorites', key: 'nav.favorites' },
  { to: '/achievements', key: 'nav.achievements' },
  { to: '/settings', key: 'nav.settings' },
];

export function Header({ hideOnMobile = false }: { hideOnMobile?: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const t = useT();

  const onSearch = (value: string) => {
    navigate({ pathname: '/', search: value ? `?q=${encodeURIComponent(value)}` : '' }, { replace: location.pathname === '/' });
  };

  return (
    <header className={`border-b border-line/60 bg-ink ${hideOnMobile ? 'hidden md:block' : ''}`}>
      <div className="page-x flex h-16 items-center gap-4 md:h-20 md:gap-8">
        <Logo />
        <nav aria-label="Main" className="ml-6 hidden items-center gap-8 xl:flex">
          {NAV.map((item) => (
            <NavLink
              key={item.key}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `relative py-2 text-[15px] font-semibold ${isActive && !item.to.includes('#') ? 'text-paper after:absolute after:inset-x-0 after:-bottom-1 after:h-0.5 after:rounded after:bg-gold' : 'text-muted hover:text-paper'}`
              }
            >
              {t(item.key)}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <label className="relative hidden md:block">
            <span className="sr-only">Search games</span>
            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-paper" />
            <input
              type="search"
              value={params.get('q') ?? ''}
              onChange={(e) => onSearch(e.target.value)}
              placeholder={`Search ${GAMES.length} games`}
              className="h-11 w-[260px] rounded-full border border-line bg-ink-2 pl-12 pr-4 text-sm text-paper placeholder:text-muted focus-visible:outline-gold xl:w-[310px]"
            />
          </label>
          <button type="button" onClick={() => navigate('/?q=')} className="grid size-9 place-items-center rounded-full text-paper md:hidden" aria-label="Search">
            <SearchIcon />
          </button>
          {user ? (
            <Link to="/profile" className="btn btn-outline hidden h-11 px-6 xl:inline-flex">{user.username}</Link>
          ) : (
            <Link to="/login" className="btn btn-outline hidden h-11 px-6 xl:inline-flex">Sign in</Link>
          )}
          <Link to={user ? '/settings' : '/login'} className="grid size-9 place-items-center rounded-full bg-ink-3 text-sm font-semibold xl:hidden" aria-label={user ? 'Account and settings' : 'Sign in'}>
            {user ? user.username[0]!.toUpperCase() : '?'}
          </Link>
        </div>
      </div>
    </header>
  );
}
