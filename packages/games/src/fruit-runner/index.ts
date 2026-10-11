import { createScroller, type ScrollerConfig } from '../_shared/side-scroller';

/** Wonder Boy-style: hurl hatchets in an arc, keep your energy up by grabbing fruit. */
export const CONFIG: ScrollerConfig = {
  id: 'fruit-runner',
  weapon: { kind: 'arc', cd: 0.5, speed: 6.5, reach: 0, dmg: 1, max: 2, life: 1.8 },
  mix: { walker: 5, hopper: 2, flyer: 1 },
  health: 1,
  energy: true,
  jump: 14,
  walk: 5.4,
  pitRate: 0.14,
  spikeRate: 0.3,
  ledgeRate: 0.4,
  colors: { sky: '#1d3f5a', ground: '#7a5a2e', top: '#4fb36b', accent: '#FF9F68' },
};

export default createScroller(CONFIG);
