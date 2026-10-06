import { Link } from 'react-router-dom';
import { GAMES } from '@arcade/shared';
import { Logo } from './Logo';

const soon = (label: string) => (
  <span className="cursor-default text-muted" title="Coming soon">
    {label}
  </span>
);

export function Footer() {
  const random = GAMES[Math.floor(Math.random() * GAMES.length)]!;
  const link = 'text-muted hover:text-paper';
  return (
    <footer className="mt-20 hidden border-t border-line/40 bg-ink-2/40 py-12 md:block">
      <div className="page-x flex justify-between gap-10">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-6 text-[15px] text-muted">
            {GAMES.length} classic-style arcade games. Free to play in your browser.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-12 text-[15px] xl:gap-20">
          <div className="flex flex-col gap-2">
            <h3 className="mb-1 font-semibold">Play</h3>
            <Link className={link} to="/">All games</Link>
            {soon('New this week')}
            <Link className={link} to={`/play/${random.slug}`}>Random game</Link>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="mb-1 font-semibold">Community</h3>
            <Link className={link} to="/leaderboards">Leaderboards</Link>
            {soon('Tournaments')}
            {soon('Discord')}
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="mb-1 font-semibold">Help</h3>
            {soon('Controls')}
            {soon('Gamepad setup')}
            {soon('Contact')}
          </div>
        </div>
      </div>
    </footer>
  );
}
