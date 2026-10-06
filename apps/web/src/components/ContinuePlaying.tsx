import { Link } from 'react-router-dom';
import { getGame } from '@arcade/shared';
import { timeAgo, useSaves } from '../lib/storage';
import { Thumb } from './Sprite';

const MAX_LEVEL = 40;

export function ContinuePlaying() {
  const saves = useSaves();
  return (
    <section aria-labelledby="continue-title" className="mt-10 md:mt-12">
      <div className="flex items-baseline justify-between">
        <h2 id="continue-title" className="text-xl font-bold md:text-[22px]">Continue playing</h2>
        {saves.length > 0 && <span className="text-sm font-semibold text-cyan">Your saves</span>}
      </div>
      {saves.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-line px-5 py-6 text-sm text-muted">
          Nothing saved yet. Press <strong className="text-paper">Save state</strong> in a game and it shows up here.
        </p>
      ) : (
        <ul className="hide-scrollbar -mx-5 mt-4 flex gap-4 overflow-x-auto px-5 md:-mx-10 md:px-10 xl:mx-0 xl:grid xl:grid-cols-4 xl:overflow-visible xl:px-0">
          {saves.map((save) => {
            const game = getGame(save.gameId);
            if (!game) return null;
            const pct = Math.min(100, (save.status.level / MAX_LEVEL) * 100);
            return (
              <li key={save.gameId} className="w-[280px] shrink-0 xl:w-auto">
                <Link
                  to={`/play/${game.slug}?resume=1`}
                  className="flex items-center gap-4 rounded-2xl border border-line bg-ink-2 p-3 transition-colors hover:border-gold"
                >
                  <Thumb slug={game.slug} className="size-[72px] shrink-0 rounded-xl" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{game.title}</span>
                    <span className="block truncate text-xs text-muted">
                      Wave {save.status.level} · saved {timeAgo(save.savedAt)}
                    </span>
                    <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-ink-3">
                      <span className="block h-full rounded-full bg-cyan" style={{ width: `${pct}%` }} />
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
