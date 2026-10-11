import { createScroller, type ScrollerConfig } from '../_shared/side-scroller';

/** Toki-style: an ape who spits fireballs, with big jumps through a hopping, flying jungle. */
export const CONFIG: ScrollerConfig = {
  id: 'jungle-spitter',
  weapon: { kind: 'throw', cd: 0.3, speed: 9, reach: 0, dmg: 1, max: 3, life: 1.1 },
  mix: { walker: 3, hopper: 4, flyer: 3, shooter: 1 },
  health: 3,
  jump: 15,
  walk: 4.8,
  pitRate: 0.16,
  spikeRate: 0.1,
  ledgeRate: 0.45,
  colors: { sky: '#12351f', ground: '#5a3e22', top: '#3f9d52', accent: '#FF5D73' },
};

export default createScroller(CONFIG);
