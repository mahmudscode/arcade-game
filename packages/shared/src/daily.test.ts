import { describe, expect, it } from 'vitest';
import { dailySeed, dailySlug, dayKey, hash32, isDayKey, prevDay, streak } from './daily';
import { getGame } from './index';

describe('daily challenge', () => {
  it('formats the UTC day and validates keys', () => {
    expect(dayKey(new Date('2026-03-05T23:59:59Z'))).toBe('2026-03-05');
    expect(isDayKey('2026-03-05')).toBe(true);
    expect(isDayKey('2026-02-30')).toBe(false);
    expect(isDayKey('2026-3-5')).toBe(false);
    expect(isDayKey('nope')).toBe(false);
  });

  it('picks the same real game and seed for the same day, and varies across days', () => {
    expect(dailySlug('2026-03-05')).toBe(dailySlug('2026-03-05'));
    expect(getGame(dailySlug('2026-03-05'))).toBeDefined();
    expect(dailySeed('2026-03-05', 'tetris-blocks')).toBe(dailySeed('2026-03-05', 'tetris-blocks'));
    const slugs = new Set(Array.from({ length: 60 }, (_, i) => dailySlug(dayKey(new Date(Date.UTC(2026, 0, 1 + i))))));
    expect(slugs.size).toBeGreaterThan(25);
    expect(dailySeed('2026-03-05', 'a')).not.toBe(dailySeed('2026-03-06', 'a'));
  });

  it('hashes to a stable unsigned 32-bit value', () => {
    expect(hash32('')).toBe(0x811c9dc5);
    expect(hash32('a')).toBe(0xe40c292c);
  });

  it('counts a streak across month boundaries', () => {
    expect(prevDay('2026-03-01')).toBe('2026-02-28');
    const played = new Set(['2026-02-27', '2026-02-28', '2026-03-01']);
    expect(streak(played, '2026-03-01')).toBe(3);
    // Today not played yet: the streak is still alive until the day ends.
    expect(streak(played, '2026-03-02')).toBe(3);
    expect(streak(played, '2026-03-03')).toBe(0);
  });
});
