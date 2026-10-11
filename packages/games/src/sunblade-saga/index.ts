import { createBrawler, type BrawlerConfig } from '../_shared/brawler';

/** Golden Axe-style: long-reach blade strikes and magic pots (Up + punch) that scorch everything on screen. */
export const CONFIG: BrawlerConfig = {
  id: 'sunblade-saga',
  lanes: true,
  hp: 100,
  combo: [9, 11, 15],
  reach: 60,
  weapons: false,
  special: 'magic',
  mix: { thug: 4, big: 2, fast: 1, thief: 2 },
  colors: { floor: '#4a3a24', wall: '#2a1a38', hero: '#A78BFA', accent: '#FFC93C' },
};

export default createBrawler(CONFIG);
