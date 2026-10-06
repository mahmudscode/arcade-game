import { createMazeChase } from '../_shared/maze-chase';
import { COLORS } from '../_shared/ui';

/** Pac-Man style: four ghosts with different targeting, power pellets, a fruit that sits still. */
export default createMazeChase({ id: 'ghost-grid', wander: 0.08, movingFruit: false, wall: COLORS.purple });
