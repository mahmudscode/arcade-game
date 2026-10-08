import { createRoadRacer } from '../_shared/road-racer';
import { COLORS } from '../_shared/ui';

/** Night Driver style: a dark road lit only by lane markers, tight curves and sparse oncoming glare. */
export default createRoadRacer({
  id: 'night-lane',
  sky: '#05030f',
  grass: ['#0b0820', '#090619'],
  rumble: [COLORS.paper, COLORS.muted],
  road: ['#16113a', '#130e33'],
  curve: 3,
  traffic: 4,
  bonusTime: 22,
  offroad: 0.6,
  tunnel: true,
});
