import { createDefender } from '../_shared/defender';
import { COLORS } from '../_shared/ui';

/** Stargate-style: the same planet defence plus mine-laying bombers and pods that burst into swarmers. */
export default createDefender({ id: 'portal-patrol', bombers: true, pods: true, accent: COLORS.gold });
