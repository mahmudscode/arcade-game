import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { GAMES, type LeaderboardEntry, type Period } from '@arcade/shared';
import { isPlayable } from '@arcade/games';
import { api } from '../lib/api';

const PERIODS: { id: Period; label: string }[] = [
  { id: 'daily', label: 'Today' },
  { id: 'weekly', label: 'This week' },
  { id: 'all', label: 'All time' },
];
const PLAYABLE = GAMES.filter((g) => isPlayable(g.slug));

export function Leaderboards() {
  const [params, setParams] = useSearchParams();
  const slug = PLAYABLE.some((g) => g.slug === params.get('game')) ? params.get('game')! : PLAYABLE[0]!.slug;
  const period = (PERIODS.find((p) => p.id === params.get('period'))?.id ?? 'weekly') as Period;
  const [items, setItems] = useState<LeaderboardEntry[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    setItems(null);
    setFailed(false);
    api.leaderboard(slug, period).then((r) => live && setItems(r), () => live && (setFailed(true), setItems([])));
    return () => {
      live = false;
    };
  }, [slug, period]);

  const set = (patch: Record<string, string>) => setParams({ game: slug, period, ...patch }, { replace: true });

  return (
    <div className="page-x pt-8 pb-8">
      <h1 className="text-2xl font-bold">Leaderboards</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">Only scores whose replay the server re-played and confirmed are ranked. Each player counts once, with their best run.</p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="text-sm text-muted">
          <span className="sr-only">Game</span>
          <select value={slug} onChange={(e) => set({ game: e.target.value })} className="h-11 rounded-full border border-line bg-ink-2 px-4 text-paper">
            {PLAYABLE.map((g) => <option key={g.slug} value={g.slug}>{g.title}</option>)}
          </select>
        </label>
        <div role="tablist" className="flex gap-1 rounded-full bg-ink-2 p-1">
          {PERIODS.map((p) => (
            <button key={p.id} type="button" role="tab" aria-selected={period === p.id} onClick={() => set({ period: p.id })} className={`btn h-9 px-4 ${period === p.id ? 'btn-gold' : 'text-muted'}`}>{p.label}</button>
          ))}
        </div>
        <Link to={`/play/${slug}`} className="btn btn-outline ml-auto h-11 px-6">Play</Link>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-ink-2">
        {items === null ? (
          <p className="px-6 py-10 text-center text-muted">Loading…</p>
        ) : failed ? (
          <p className="px-6 py-10 text-center text-muted">The server isn’t reachable right now.</p>
        ) : items.length === 0 ? (
          <p className="px-6 py-10 text-center text-muted">No verified scores here yet. <Link to="/login" className="font-semibold text-gold underline">Sign in</Link> and set the first one.</p>
        ) : (
          <ol>
            {items.map((e) => (
              <li key={e.username} className="flex items-center border-b border-line/50 px-5 py-3 last:border-0">
                <span className="w-12 font-pixel text-xs text-muted">{e.rank}</span>
                <Link to={`/profile/${e.username}`} className={`flex-1 font-semibold hover:underline ${e.rank === 1 ? 'text-gold' : ''}`}>{e.username}</Link>
                <span className={`font-pixel text-xs ${e.rank === 1 ? 'text-gold' : ''}`}>{e.score.toLocaleString('en-US')}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
