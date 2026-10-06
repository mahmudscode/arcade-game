import { useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { CATEGORIES, FEATURED_SLUG, GAMES, getGame, type Category } from '@arcade/shared';
import { CategoryChips } from '../components/CategoryChips';
import { ContinuePlaying } from '../components/ContinuePlaying';
import { GameCard } from '../components/GameCard';
import { Hero } from '../components/Hero';
import { ChevronDownIcon, GridIcon, ListIcon } from '../components/icons';

const PAGE = 24;
type Sort = 'plays' | 'name';

export function Home() {
  const [params] = useSearchParams();
  const { hash } = useLocation();
  const q = (params.get('q') ?? '').trim().toLowerCase();
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [sort, setSort] = useState<Sort>('plays');
  const [list, setList] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash]);

  const games = useMemo(() => {
    const filtered = GAMES.filter((g) => (category === 'all' || g.category === category) && (!q || g.title.toLowerCase().includes(q) || g.category.toLowerCase().includes(q)));
    return [...filtered].sort((a, b) => (sort === 'plays' ? b.plays - a.plays : a.title.localeCompare(b.title)));
  }, [category, q, sort]);

  const featured = getGame(FEATURED_SLUG)!;
  const visible = games.slice(0, limit);

  return (
    <div className="page-x pt-6 md:pt-8">
      <Hero game={featured} />
      <div className="mt-8 md:mt-10">
        <CategoryChips value={category} onChange={(c) => { setCategory(c); setLimit(PAGE); }} />
      </div>

      <ContinuePlaying />

      <section id="all-games" aria-labelledby="all-title" className="mt-10 scroll-mt-4 md:mt-12">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <h2 id="all-title" className="text-xl font-bold md:text-[22px]">
            {category === 'all' ? 'All games' : CATEGORIES.find((c) => c.id === category)?.label}
          </h2>
          <p className="text-sm text-muted" aria-live="polite">
            Showing {visible.length} of {games.length}
            {q && ` for “${params.get('q')}”`}
          </p>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden rounded-full border border-line bg-ink-2 p-1 md:flex" role="group" aria-label="Layout">
              {[
                { v: false, label: 'Grid view', Icon: GridIcon },
                { v: true, label: 'List view', Icon: ListIcon },
              ].map(({ v, label, Icon }) => (
                <button
                  key={label}
                  type="button"
                  aria-label={label}
                  aria-pressed={list === v}
                  onClick={() => setList(v)}
                  className={`grid h-8 w-10 place-items-center rounded-full ${list === v ? 'bg-ink-3 text-gold' : 'text-muted'}`}
                >
                  <Icon width={18} height={18} />
                </button>
              ))}
            </div>
            <label className="relative">
              <span className="sr-only">Sort games</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className="h-11 appearance-none rounded-full border border-line bg-ink-2 pl-5 pr-11 text-sm font-medium text-paper"
              >
                <option value="plays">Sort: Most played</option>
                <option value="name">Sort: A to Z</option>
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2" width={16} height={16} />
            </label>
          </div>
        </div>

        {games.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-dashed border-line px-6 py-12 text-center text-muted">
            No games match. Try a different search or category.
          </p>
        ) : (
          <ul className={list ? 'mt-6 grid gap-3 md:grid-cols-2' : 'mt-6 grid grid-cols-2 gap-x-3.5 gap-y-7 md:grid-cols-4 md:gap-x-5 xl:grid-cols-6 xl:gap-x-6'}>
            {visible.map((g) => (
              <li key={g.slug}>
                <GameCard game={g} list={list} />
              </li>
            ))}
          </ul>
        )}

        {games.length > limit && (
          <div className="mt-10 text-center">
            <button type="button" className="btn btn-soft h-[52px] px-10 text-base" onClick={() => setLimit((l) => l + PAGE)}>
              Load {Math.min(PAGE, games.length - limit)} more
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
