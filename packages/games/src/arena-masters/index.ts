import { createFighter, type FighterConfig } from '../_shared/fighter';

/** Street Fighter II-style: health bars, punches, kicks, sweeps and a fireball (Down, Forward, Punch); best of three rounds. */
export const CONFIG: FighterConfig = {
  id: 'arena-masters',
  scoring: 'hp',
  fireball: true,
  hp: 100,
  target: 0,
  roster: ['Brickhand', 'Tidecaller', 'Ironwing', 'Emberfist', 'Nightshade', 'The Warden'],
  colors: { floor: '#3b3350', wall: '#1d1440', hero: '#4FE3D6', foe: '#FF5D73' },
};

export default createFighter(CONFIG);
