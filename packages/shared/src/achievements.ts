import { CATEGORIES, GAMES } from './index';

/** What the achievements are judged on: a summary of one player's local history. */
export interface PlayerStats {
  runs: number;
  /** Per game slug: runs finished, best score, highest level reached. */
  games: Record<string, { runs: number; best: number; maxLevel: number }>;
  favorites: number;
  dailyStreak: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  /** Progress toward the goal, for the progress bar: `[done, goal]`. */
  progress(s: PlayerStats): [number, number];
}

const played = (s: PlayerStats) => Object.keys(s.games).length;
const bestEver = (s: PlayerStats) => Math.max(0, ...Object.values(s.games).map((g) => g.best));
const deepest = (s: PlayerStats) => Math.max(0, ...Object.values(s.games).map((g) => g.maxLevel));
const categoriesPlayed = (s: PlayerStats) => {
  const set = new Set<string>();
  for (const slug of Object.keys(s.games)) {
    const g = GAMES.find((x) => x.slug === slug);
    if (g) set.add(g.category);
  }
  return set.size;
};

const goal = (id: string, title: string, description: string, value: (s: PlayerStats) => number, target: number): Achievement => ({
  id,
  title,
  description,
  progress: (s) => [Math.min(value(s), target), target],
});

export const ACHIEVEMENTS: Achievement[] = [
  goal('first-credit', 'First Credit', 'Finish your first run.', (s) => s.runs, 1),
  goal('warming-up', 'Warming Up', 'Finish 10 runs.', (s) => s.runs, 10),
  goal('marathon', 'Marathon', 'Finish 50 runs.', (s) => s.runs, 50),
  goal('explorer', 'Explorer', 'Play 10 different games.', played, 10),
  goal('regular', 'Arcade Regular', 'Play 25 different games.', played, 25),
  goal('completionist', 'Completionist', 'Play 50 different games.', played, 50),
  goal('globetrotter', 'Genre Hopper', 'Play a game from every category.', categoriesPlayed, CATEGORIES.length),
  goal('high-roller', 'High Roller', 'Score 10,000 in any game.', bestEver, 10_000),
  goal('big-league', 'Big League', 'Score 100,000 in any game.', bestEver, 100_000),
  goal('deep-dive', 'Deep Dive', 'Reach level 5 in any game.', deepest, 5),
  goal('collector', 'Collector', 'Add 5 games to your favorites.', (s) => s.favorites, 5),
  goal('daily-devotee', 'Daily Devotee', 'Play the daily challenge 3 days in a row.', (s) => s.dailyStreak, 3),
  goal('week-warrior', 'Week Warrior', 'Play the daily challenge 7 days in a row.', (s) => s.dailyStreak, 7),
];

export const isUnlocked = (a: Achievement, s: PlayerStats): boolean => {
  const [done, target] = a.progress(s);
  return done >= target;
};

/** Ids of every achievement the stats satisfy. */
export const unlockedIds = (s: PlayerStats): string[] => ACHIEVEMENTS.filter((a) => isUnlocked(a, s)).map((a) => a.id);

export const emptyStats = (): PlayerStats => ({ runs: 0, games: {}, favorites: 0, dailyStreak: 0 });

/** Folds one finished run into the stats (returns a new object). */
export function withRun(s: PlayerStats, slug: string, score: number, level: number): PlayerStats {
  const g = s.games[slug] ?? { runs: 0, best: 0, maxLevel: 0 };
  return { ...s, runs: s.runs + 1, games: { ...s.games, [slug]: { runs: g.runs + 1, best: Math.max(g.best, score), maxLevel: Math.max(g.maxLevel, level) } } };
}
