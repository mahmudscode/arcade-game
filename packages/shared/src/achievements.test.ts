import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, emptyStats, isUnlocked, unlockedIds, withRun } from './achievements';
import { GAMES } from './index';

describe('achievements', () => {
  it('has unique ids and starts with nothing unlocked', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    expect(unlockedIds(emptyStats())).toEqual([]);
  });

  it('folds runs into the stats without mutating', () => {
    const a = emptyStats();
    const b = withRun(a, 'x', 500, 2);
    const c = withRun(b, 'x', 300, 4);
    expect(a.runs).toBe(0);
    expect(c.runs).toBe(2);
    expect(c.games.x).toEqual({ runs: 2, best: 500, maxLevel: 4 });
  });

  it('unlocks the first credit on the first run', () => {
    expect(unlockedIds(withRun(emptyStats(), 'x', 0, 1))).toEqual(['first-credit']);
  });

  it('counts distinct games and categories', () => {
    let s = emptyStats();
    for (const g of GAMES.slice(0, 10)) s = withRun(s, g.slug, 100, 1);
    const ids = unlockedIds(s);
    expect(ids).toContain('explorer');
    expect(ids).toContain('warming-up');
    expect(ids).not.toContain('regular');
    for (const g of GAMES) s = withRun(s, g.slug, 100, 1);
    expect(unlockedIds(s)).toContain('globetrotter');
    expect(unlockedIds(s)).toContain('completionist');
  });

  it('judges score, depth, favorites and streaks', () => {
    const s = { ...withRun(emptyStats(), GAMES[0]!.slug, 120_000, 6), favorites: 5, dailyStreak: 7 };
    const ids = unlockedIds(s);
    for (const id of ['high-roller', 'big-league', 'deep-dive', 'collector', 'daily-devotee', 'week-warrior']) expect(ids).toContain(id);
  });

  it('reports bounded progress', () => {
    const a = ACHIEVEMENTS.find((x) => x.id === 'marathon')!;
    expect(a.progress({ ...emptyStats(), runs: 20 })).toEqual([20, 50]);
    expect(a.progress({ ...emptyStats(), runs: 999 })).toEqual([50, 50]);
    expect(isUnlocked(a, { ...emptyStats(), runs: 50 })).toBe(true);
  });
});
