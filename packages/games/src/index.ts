import type { GameDefinition } from '@arcade/engine';

type Loader = () => Promise<{ default: GameDefinition<any> }>;

/**
 * Registry of playable games. Each game is a separate chunk loaded on demand, so adding
 * a game never grows the initial bundle. Slugs match the catalog in @arcade/shared.
 */
const loaders: Record<string, Loader> = {
  'comet-crusher': () => import('./comet-crusher'),
  'saucer-swarm': () => import('./saucer-swarm'),
};

export function isPlayable(slug: string): boolean {
  return slug in loaders;
}

export async function loadGame(slug: string): Promise<GameDefinition<any> | null> {
  const loader = loaders[slug];
  return loader ? (await loader()).default : null;
}
