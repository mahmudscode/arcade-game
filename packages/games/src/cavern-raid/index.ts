import { createScrollShooter } from '../_shared/scroll-shooter';
import { COLORS } from '../_shared/ui';

/** Scramble-style: fly over scrolling terrain, shoot turrets and fuel tanks, never run dry or crash. */
export default createScrollShooter({
  id: 'cavern-raid',
  vertical: false,
  speed: 250,
  fireInterval: 0.2,
  mix: { wave: 2, chaser: 1, turret: 3, fuel: 2 },
  terrain: true,
  fuel: true,
  accent: COLORS.coral,
});
