import { createScroller, type ScrollerConfig } from '../_shared/side-scroller';

/** Rolling Thunder-style: a spy with a limited pistol, restocking ammo by slipping through doors. */
export const CONFIG: ScrollerConfig = {
  id: 'shadow-agent',
  weapon: { kind: 'throw', cd: 0.2, speed: 14, reach: 0, dmg: 1, max: 3, life: 0.9 },
  mix: { walker: 4, shooter: 3, hopper: 1 },
  ammo: 14,
  doors: true,
  health: 3,
  jump: 12.5,
  walk: 5,
  pitRate: 0.08,
  spikeRate: 0.1,
  ledgeRate: 0.5,
  colors: { sky: '#101a2e', ground: '#2a3550', top: '#4a5f8f', accent: '#4FE3D6' },
};

export default createScroller(CONFIG);
