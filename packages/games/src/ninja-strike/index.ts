import { createScroller, type ScrollerConfig } from '../_shared/side-scroller';

/** Shinobi-style: throw shuriken at range, slash up close, and free hostages along the way. */
export const CONFIG: ScrollerConfig = {
  id: 'ninja-strike',
  weapon: { kind: 'hybrid', cd: 0.28, speed: 13, reach: 1.7, dmg: 1, max: 3, life: 1.1 },
  mix: { walker: 3, hopper: 3, flyer: 2, shooter: 2 },
  hostages: true,
  health: 3,
  jump: 15,
  walk: 5.6,
  pitRate: 0.12,
  spikeRate: 0.12,
  ledgeRate: 0.45,
  colors: { sky: '#1b1233', ground: '#352a4d', top: '#7a5fb0', accent: '#FF5D73' },
};

export default createScroller(CONFIG);
