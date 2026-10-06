import { createScrollShooter } from '../_shared/scroll-shooter';
import { COLORS } from '../_shared/ui';

/** 1942-style vertical shooter: waves of planes, heavy gunships, weapon pickups. */
export default createScrollShooter({
  id: 'sky-ace-88',
  vertical: true,
  speed: 280,
  fireInterval: 0.16,
  mix: { wave: 5, chaser: 2, heavy: 1 },
  accent: COLORS.gold,
});
