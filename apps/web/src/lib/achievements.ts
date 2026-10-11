import { useSyncExternalStore } from 'react';
import { ACHIEVEMENTS, emptyStats, unlockedIds, withRun, type Achievement, type PlayerStats } from '@arcade/shared/achievements';
import { currentStreak } from './daily';

const STATS = 'arcade:stats';
const UNLOCKED = 'arcade:achievements';
const FAVS = 'arcade:favorites';

const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const notify = () => {
  for (const l of listeners) l();
};

function get(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function put(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked or full: achievements just won't persist.
  }
}

function parse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Run history plus the numbers other stores own (favorites, daily streak). */
function currentStats(): PlayerStats {
  const base = parse<PlayerStats>(get(STATS, ''), emptyStats());
  return { ...emptyStats(), ...base, favorites: parse<string[]>(get(FAVS, '[]'), []).length, dailyStreak: currentStreak() };
}

type Toast = { id: string; at: number };
let latest: Toast[] = [];

/** Unlocks anything newly earned, remembers it, and queues a toast for each. Returns the new ids. */
export function syncUnlocks(): string[] {
  const have = parse<Record<string, number>>(get(UNLOCKED, '{}'), {});
  const fresh = unlockedIds(currentStats()).filter((id) => !(id in have));
  if (fresh.length === 0) return [];
  const now = Date.now();
  for (const id of fresh) have[id] = now;
  put(UNLOCKED, have);
  latest = [...latest, ...fresh.map((id) => ({ id, at: now }))];
  notify();
  return fresh;
}

/** Records a finished run and checks for new achievements. */
export function recordRun(slug: string, score: number, level: number): void {
  const stats = withRun(parse<PlayerStats>(get(STATS, ''), emptyStats()), slug, score, level);
  put(STATS, stats);
  syncUnlocks();
  notify();
}

export function useAchievements(): { list: { a: Achievement; done: number; goal: number; unlockedAt: number | null }[]; unlocked: number } {
  const stats = useSyncExternalStore(subscribe, () => get(STATS, ''), () => '');
  const have = useSyncExternalStore(subscribe, () => get(UNLOCKED, '{}'), () => '{}');
  void stats;
  const s = currentStats();
  const unlockedAt = parse<Record<string, number>>(have, {});
  const list = ACHIEVEMENTS.map((a) => {
    const [done, goal] = a.progress(s);
    return { a, done, goal, unlockedAt: unlockedAt[a.id] ?? null };
  });
  return { list, unlocked: list.filter((x) => x.unlockedAt !== null).length };
}

/** The most recent unlock waiting to be shown, and a way to dismiss it. */
export function useToast(): { achievement: Achievement | null; dismiss: () => void } {
  const count = useSyncExternalStore(subscribe, () => latest.length, () => 0);
  const id = count > 0 ? latest[0]!.id : null;
  return {
    achievement: id ? (ACHIEVEMENTS.find((a) => a.id === id) ?? null) : null,
    dismiss: () => {
      latest = latest.slice(1);
      notify();
    },
  };
}
