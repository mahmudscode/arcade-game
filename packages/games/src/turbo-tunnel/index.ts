import { createRoadRacer } from '../_shared/road-racer';
import { COLORS } from '../_shared/ui';

/** Pole Position style: tight curves through a dark tunnel with heavy traffic. */
export default createRoadRacer({
  id: 'turbo-tunnel',
  sky: '#0a0620',
  grass: ['#1a1040', '#150c36'],
  rumble: [COLORS.coral, COLORS.paper],
  road: ['#33295c', '#2c2352'],
  curve: 3.2,
  traffic: 5,
  bonusTime: 22,
  offroad: 0.55,
  tunnel: true,
});
