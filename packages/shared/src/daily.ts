import { GAMES } from './index';

/** Daily challenges: every player gets the same game and the same seed on a given UTC day. */
const KEY = /^\d{4}-\d{2}-\d{2}$/;

/** UTC calendar day, `YYYY-MM-DD`. */
export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export const isDayKey = (s: string): boolean => KEY.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && dayKey(new Date(`${s}T00:00:00Z`)) === s;

/** FNV-1a: a small, stable string hash (the same on every platform, unlike anything seeded by the engine). */
export function hash32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The featured game for a day. */
export function dailySlug(key: string): string {
  return GAMES[hash32(`pick:${key}`) % GAMES.length]!.slug;
}

/** The fixed run seed for a game on a day. */
export function dailySeed(key: string, slug: string): number {
  return hash32(`seed:${key}:${slug}`);
}

/** The previous UTC day. */
export function prevDay(key: string): string {
  return dayKey(new Date(Date.parse(`${key}T00:00:00Z`) - 86_400_000));
}

/** Consecutive days played, counting back from `today` (today may still be unplayed). */
export function streak(played: ReadonlySet<string>, today: string): number {
  let day = played.has(today) ? today : prevDay(today);
  let n = 0;
  while (played.has(day)) {
    n += 1;
    day = prevDay(day);
  }
  return n;
}
