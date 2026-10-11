import { useEffect } from 'react';
import { useT } from '../lib/i18n';
import { syncUnlocks, useAchievements } from '../lib/achievements';

export function Achievements() {
  const { list, unlocked } = useAchievements();
  const t = useT();
  // Favorites and daily streaks live in other stores; pick up anything they earned.
  useEffect(() => {
    syncUnlocks();
  }, []);
  return (
    <div className="page-x pt-8">
      <h1 className="text-2xl font-bold">{t('achievements.title')}</h1>
      <p className="mt-2 text-sm text-muted">{t('achievements.summary', { n: unlocked, total: list.length })}</p>
      <ul className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {list.map(({ a, done, goal, unlockedAt }) => (
          <li key={a.id} className={`rounded-2xl border p-4 ${unlockedAt ? 'border-gold/60 bg-ink-2' : 'border-line bg-ink-2/60'}`}>
            <div className="flex items-center gap-2">
              <span aria-hidden>{unlockedAt ? '🏆' : '🔒'}</span>
              <h2 className="font-semibold">{a.title}</h2>
              {unlockedAt && <span className="sr-only">Unlocked</span>}
            </div>
            <p className="mt-1 text-sm text-muted">{a.description}</p>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-3" role="progressbar" aria-label={`${a.title} progress`} aria-valuemin={0} aria-valuemax={goal} aria-valuenow={done}>
                <div className="h-full bg-gold" style={{ width: `${(100 * done) / goal}%` }} />
              </div>
              <span className="font-pixel text-[10px] text-muted">{done.toLocaleString('en-US')}/{goal.toLocaleString('en-US')}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
