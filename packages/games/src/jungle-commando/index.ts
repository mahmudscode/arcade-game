import { createScroller, type ScrollerConfig } from '../_shared/side-scroller';

/** Contra-style: run and gun in eight directions, lie flat to duck bullets, grab the spread gun. One hit kills. */
export const CONFIG: ScrollerConfig = {
  id: 'jungle-commando',
  weapon: { kind: 'throw', cd: 0.13, speed: 14, reach: 0, dmg: 1, max: 5, life: 0.9 },
  mix: { runner: 5, shooter: 3, walker: 1, flyer: 2 },
  aim8: true,
  prone: true,
  health: 1,
  jump: 14,
  walk: 5.2,
  pitRate: 0.1,
  spikeRate: 0.08,
  ledgeRate: 0.5,
  colors: { sky: '#102a22', ground: '#3a3a2a', top: '#5f8f3a', accent: '#FF5D73' },
};

export default createScroller(CONFIG);
