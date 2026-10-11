import { createBrawler, type BrawlerConfig } from '../_shared/brawler';

/** Final Fight-style: heavier hits and a spin attack (Down + punch) that costs a little health. */
export const CONFIG: BrawlerConfig = {
  id: 'metro-rumble',
  lanes: true,
  hp: 120,
  combo: [8, 10, 16],
  reach: 48,
  weapons: true,
  special: 'spin',
  mix: { thug: 4, fast: 2, knife: 2, big: 2, thief: 1 },
  colors: { floor: '#2f3a4a', wall: '#14202e', hero: '#FFC93C', accent: '#4FE3D6' },
};

export default createBrawler(CONFIG);
