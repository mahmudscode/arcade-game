import { createDefender } from '../_shared/defender';
import { COLORS } from '../_shared/ui';

/** Defender-style: protect ten humanoids on a long wrapping planet from abducting landers. */
export default createDefender({ id: 'planet-patrol', bombers: false, pods: false, accent: COLORS.cyan });
