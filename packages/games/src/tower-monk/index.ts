import { createBrawler, type BrawlerConfig } from '../_shared/brawler';

/** Kung-Fu Master-style: one corridor, grippers to shake off, knife throwers (duck high, jump low) and a boss at the end. */
export const CONFIG: BrawlerConfig = {
  id: 'tower-monk',
  lanes: false,
  hp: 80,
  combo: [8, 8, 14],
  reach: 44,
  weapons: false,
  special: 'none',
  mix: { thug: 3, gripper: 4, thrower: 2, fast: 1 },
  colors: { floor: '#5a2e2e', wall: '#2a1218', hero: '#FF9F68', accent: '#FFC93C' },
};

export default createBrawler(CONFIG);
