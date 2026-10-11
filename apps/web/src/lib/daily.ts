import { useSyncExternalStore } from 'react';
import { dailySeed, dailySlug, dayKey, isDayKey, streak } from '@arcade/shared/daily';

const KEY = 'arcade:daily';

/** Best score per `day:slug`, kept in this browser (daily runs use a public seed, so they aren't verified). */
type Results = Record<string, number>;

const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

function read(): string {
  try {
    return localStorage.getItem(KEY) ?? '{}';
  } catch {
    return '{}';
  }
}

export function recordDaily(day: string, slug: string, score: number): void {
  try {
    const all = JSON.parse(read()) as Results;
    const k = `${day}:${slug}`;
    all[k] = Math.max(all[k] ?? 0, score);
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Storage blocked: the challenge still works, it just isn't remembered.
  }
  for (const l of listeners) l();
}

export const todayKey = () => dayKey(new Date());

/** The daily game, today's best for it, and the current streak of days with a daily run. */
export function useDaily() {
  const raw = useSyncExternalStore(subscribe, read, () => '{}');
  const results = JSON.parse(raw) as Results;
  const day = todayKey();
  const slug = dailySlug(day);
  const played = new Set(Object.keys(results).map((k) => k.slice(0, 10)));
  return { day, slug, best: results[`${day}:${slug}`] ?? 0, streak: streak(played, day), playedToday: played.has(day) };
}

/** Parses `?daily=YYYY-MM-DD` into a fixed seed for the game, or null if absent/invalid/in the future. */
export function dailyFromParam(param: string | null, slug: string): { day: string; seed: number } | null {
  if (!param || !isDayKey(param) || param > todayKey()) return null;
  return { day: param, seed: dailySeed(param, slug) };
}

/** Current daily streak without subscribing (for achievement checks). */
export function currentStreak(): number {
  try {
    const results = JSON.parse(read()) as Results;
    return streak(new Set(Object.keys(results).map((k) => k.slice(0, 10))), todayKey());
  } catch {
    return 0;
  }
}
