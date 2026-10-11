import { createScroller, type ScrollerConfig } from '../_shared/side-scroller';

/** Rygar-style: a spinning disc on a tether reaches forward and cuts down everything in front. */
export const CONFIG: ScrollerConfig = {
  id: 'disc-warrior',
  weapon: { kind: 'melee', cd: 0.34, speed: 0, reach: 2.8, dmg: 1, max: 1, life: 0 },
  mix: { walker: 4, hopper: 3, flyer: 2, shooter: 1 },
  health: 3,
  jump: 13.5,
  walk: 5,
  pitRate: 0.12,
  spikeRate: 0.12,
  ledgeRate: 0.35,
  colors: { sky: '#17233a', ground: '#4a3b2a', top: '#6e8f4a', accent: '#FFC93C' },
};

export default createScroller(CONFIG);
