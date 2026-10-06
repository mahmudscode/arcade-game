import { Link } from 'react-router-dom';
import { formatPlays, type GameMeta } from '@arcade/shared';
import { useFavorites } from '../lib/storage';
import { HeartIcon } from './icons';
import { Thumb } from './Sprite';

export function GameCard({ game, list = false }: { game: GameMeta; list?: boolean }) {
  const { favs, toggle } = useFavorites();
  const fav = favs.has(game.slug);
  return (
    <div className={`group relative ${list ? 'flex items-center gap-4 rounded-2xl border border-line/60 bg-ink-2 p-3' : ''}`}>
      <Link
        to={`/play/${game.slug}`}
        className={`block rounded-2xl outline-offset-0 transition-transform duration-150 hover:-translate-y-1 focus-visible:-translate-y-1 ${list ? 'flex flex-1 items-center gap-4' : ''}`}
      >
        <span className={`block overflow-hidden rounded-xl ring-2 ring-transparent transition group-hover:ring-gold group-focus-within:ring-gold ${list ? 'w-28 shrink-0' : ''}`}>
          <Thumb slug={game.slug} className="block aspect-[4/3] w-full" />
        </span>
        <span className={`block ${list ? '' : 'mt-3'}`}>
          <span className="block truncate text-[15px] font-semibold leading-tight">{game.title}</span>
          <span className="mt-1 block text-xs text-muted">
            {game.category} · {formatPlays(game.plays)} plays
          </span>
        </span>
      </Link>
      <button
        type="button"
        onClick={() => toggle(game.slug)}
        aria-pressed={fav}
        aria-label={fav ? `Remove ${game.title} from favorites` : `Add ${game.title} to favorites`}
        className={`absolute grid size-7 place-items-center rounded-full bg-ink/70 text-paper backdrop-blur hover:bg-ink ${list ? 'right-4 top-1/2 -translate-y-1/2' : 'right-2 top-2'} ${fav ? 'text-coral' : ''}`}
      >
        <HeartIcon width={15} height={15} filled={fav} />
      </button>
    </div>
  );
}
