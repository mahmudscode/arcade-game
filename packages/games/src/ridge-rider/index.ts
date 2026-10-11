import { createRoadRacer } from '../_shared/road-racer';
import { COLORS } from '../_shared/ui';

/** Hang-On style: a superbike on a sunny coastal road, leaning through long bends against the checkpoint clock. */
export default createRoadRacer({
  id: 'ridge-rider',
  sky: '#4aa8e8',
  grass: ['#3f9d4b', '#378f43'],
  rumble: [COLORS.coral, COLORS.paper],
  road: ['#6d6a7a', '#64617a'],
  curve: 4.5,
  traffic: 5,
  bonusTime: 28,
  offroad: 0.55,
  bike: true,
});
