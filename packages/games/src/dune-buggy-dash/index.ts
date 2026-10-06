import { createRoadRacer } from '../_shared/road-racer';
import { COLORS } from '../_shared/ui';

/** Out Run style: sunny desert drive with long sweeping curves and lighter traffic. */
export default createRoadRacer({
  id: 'dune-buggy-dash',
  sky: '#ffb36b',
  grass: ['#e8b45b', '#dba94f'],
  rumble: [COLORS.coral, COLORS.paper],
  road: ['#6b5b8f', '#645486'],
  curve: 2.2,
  traffic: 3,
  bonusTime: 28,
  offroad: 0.4,
});
