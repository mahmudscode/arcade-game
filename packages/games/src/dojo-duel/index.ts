import { createFighter, type FighterConfig } from '../_shared/fighter';

/** Karate Champ-style: no health, just points: the first clean hit scores, first to four takes the round. */
export const CONFIG: FighterConfig = {
  id: 'dojo-duel',
  scoring: 'points',
  fireball: false,
  hp: 0,
  target: 4,
  roster: ['Sensei Oak', 'Reed', 'Stone Lotus', 'Crane', 'Red Tiger', 'Grand Master'],
  colors: { floor: '#7a5a3a', wall: '#3a2a22', hero: '#F6EFFF', foe: '#FFC93C' },
};

export default createFighter(CONFIG);
