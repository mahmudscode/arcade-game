import { Link } from 'react-router-dom';
import { GAMES } from '@arcade/shared';
import { GameCard } from '../components/GameCard';
import { useFavorites } from '../lib/storage';

export function Favorites() {
  const { favs } = useFavorites();
  const games = GAMES.filter((g) => favs.has(g.slug));
  return (
    <div className="page-x pt-8">
      <h1 className="text-2xl font-bold">Favorites</h1>
      {games.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-line px-6 py-12 text-center text-muted">
          No favorites yet. Tap the heart on any game, or{' '}
          <Link to="/" className="font-semibold text-gold underline">browse all games</Link>.
        </p>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-x-3.5 gap-y-7 md:grid-cols-4 md:gap-x-5 xl:grid-cols-6 xl:gap-x-6">
          {games.map((g) => (
            <li key={g.slug}><GameCard game={g} /></li>
          ))}
        </ul>
      )}
    </div>
  );
}
