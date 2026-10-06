import { createScrollShooter } from '../_shared/scroll-shooter';
import { COLORS } from '../_shared/ui';

/** R-Type-style: tap to shoot, hold to charge a piercing beam. */
export default createScrollShooter({
  id: 'beam-lancer',
  vertical: false,
  speed: 270,
  fireInterval: 0.22,
  mix: { wave: 4, chaser: 2, heavy: 2 },
  charge: true,
  accent: COLORS.cyan,
});
