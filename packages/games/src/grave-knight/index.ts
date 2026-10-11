import { createScroller, type ScrollerConfig } from '../_shared/side-scroller';

/** Ghosts 'n Goblins-style: throw lances at the undead; the first hit costs your armour, the second kills. */
export const CONFIG: ScrollerConfig = {
  id: 'grave-knight',
  weapon: { kind: 'throw', cd: 0.38, speed: 11, reach: 0, dmg: 1, max: 2, life: 1.3 },
  mix: { walker: 1, flyer: 3, shooter: 2 },
  rising: true,
  health: 2,
  jump: 13,
  walk: 4.6,
  pitRate: 0.1,
  spikeRate: 0.15,
  ledgeRate: 0.35,
  colors: { sky: '#1a1030', ground: '#3b2f45', top: '#5b4a73', accent: '#A78BFA' },
};

export default createScroller(CONFIG);
