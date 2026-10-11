import { createVRoad } from '../_shared/vroad';

/** Bump 'n' Jump style: a bouncing buggy; leap the water, land on rivals to squash them and shove them off the road. */
export default createVRoad({
  id: 'bounce-buggy',
  mode: 'bump',
  colors: { ground: '#8a6a3a', road: '#5a5a6e', edge: '#E8E3F5', car: '#FFC93C' },
});
