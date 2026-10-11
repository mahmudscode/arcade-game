import { createBrawler, type BrawlerConfig } from '../_shared/brawler';

/** Double Dragon-style: a three-hit punch combo, jump kicks, and knives and bats grabbed from fallen thugs and crates. */
export const CONFIG: BrawlerConfig = {
  id: 'back-alley-brawl',
  lanes: true,
  hp: 100,
  combo: [6, 8, 12],
  reach: 44,
  weapons: true,
  special: 'none',
  mix: { thug: 4, fast: 2, knife: 2, big: 1 },
  colors: { floor: '#3b3350', wall: '#1d1440', hero: '#4FE3D6', accent: '#FF5D73' },
};

export default createBrawler(CONFIG);
