import { createBoxer, type BoxerConfig } from '../_shared/boxer';

/** Punch-Out-style: read the wind-up, lean away, counter while he is open, and spend stars on an uppercut. */
export const CONFIG: BoxerConfig = {
  id: 'glove-rush',
  roster: ['Glass Jaw Gus', 'Tango Tony', 'Mad Maurice', 'Iron Ivan', 'Cobra Kane', 'The Champ'],
  colors: { ring: '#33407a', rope: '#FF5D73', foe: '#7a4a9a', glove: '#FF5D73' },
};

export default createBoxer(CONFIG);
