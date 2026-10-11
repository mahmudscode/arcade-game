import { createVRoad } from '../_shared/vroad';

/** Spy Hunter style: a gun-armed car on a winding road; shoot the hostile cars, spare the civilians, and collect missiles from weapon vans. */
export default createVRoad({
  id: 'road-agent',
  mode: 'spy',
  colors: { ground: '#2a5a34', road: '#43425a', edge: '#E8E3F5', car: '#4FE3D6' },
});
