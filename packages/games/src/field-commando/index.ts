import { createGunner, type GunnerConfig } from '../_shared/gunner';

/** Commando-style: advance up the field on foot, shooting in eight directions and lobbing grenades over cover. One hit kills. */
export const CONFIG: GunnerConfig = {
  id: 'field-commando',
  hp: 1,
  grenades: 4,
  vehicle: false,
  mix: { soldier: 5, runner: 3, grenadier: 2, bunker: 1 },
  colors: { ground: '#5c6a35', cover: '#3a4a26', hero: '#4FE3D6', accent: '#FFC93C' },
};

export default createGunner(CONFIG);
