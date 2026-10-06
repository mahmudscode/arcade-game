import { createMazeChase } from '../_shared/maze-chase';

/** Ms. Pac-Man style: ghosts wander more unpredictably and the bonus fruit roams the maze. */
export default createMazeChase({ id: 'pellet-pursuit', wander: 0.3, movingFruit: true, wall: '#4f6bd8' });
