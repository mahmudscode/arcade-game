import { createCircuit, type CircuitConfig } from '../_shared/circuit';

/** Super Sprint-style: a single-screen circuit with three rivals; slide through the bends, grab wrenches, finish in the top two. */
export const CONFIG: CircuitConfig = {
  id: 'sprint-circuit',
  laps: 4,
  rivals: 3,
  qualify: 2,
  colors: { grass: '#2f6b3a', track: '#4b4a5e', edge: '#E8E3F5', car: '#4FE3D6' },
};

export default createCircuit(CONFIG);
