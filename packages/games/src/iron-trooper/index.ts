import { createGunner, type GunnerConfig } from '../_shared/gunner';

/** Ikari-style: two commandos' worth of firepower, with tanks to commandeer that soak up four hits. */
export const CONFIG: GunnerConfig = {
  id: 'iron-trooper',
  hp: 1,
  grenades: 5,
  vehicle: true,
  mix: { soldier: 5, runner: 3, grenadier: 2, bunker: 2 },
  colors: { ground: '#7a6a42', cover: '#4e4430', hero: '#FF9F68', accent: '#4FE3D6' },
};

export default createGunner(CONFIG);
