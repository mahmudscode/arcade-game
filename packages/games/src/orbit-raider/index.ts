import { createScrollShooter } from '../_shared/scroll-shooter';
import { COLORS } from '../_shared/ui';

/** Gradius-style: collect pickups to upgrade your shot, then gain trailing option orbs. */
export default createScrollShooter({
  id: 'orbit-raider',
  vertical: false,
  speed: 260,
  fireInterval: 0.17,
  mix: { wave: 5, chaser: 2, heavy: 1 },
  options: true,
  accent: COLORS.purple,
});
