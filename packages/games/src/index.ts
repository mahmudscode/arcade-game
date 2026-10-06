import type { GameDefinition } from '@arcade/engine';

type Loader = () => Promise<{ default: GameDefinition<any> }>;

/**
 * Registry of playable games. Each game is a separate chunk loaded on demand, so adding
 * a game never grows the initial bundle. Slugs match the catalog in @arcade/shared.
 */
const loaders: Record<string, Loader> = {
  'comet-crusher': () => import('./comet-crusher'),
  'saucer-swarm': () => import('./saucer-swarm'),
  'star-divers': () => import('./star-divers'),
  'sky-shield': () => import('./sky-shield'),
  'lunar-descent': () => import('./lunar-descent'),
  'brick-bash': () => import('./brick-bash'),
  'vault-breaker': () => import('./vault-breaker'),
  'neon-serpent': () => import('./neon-serpent'),
  'block-tumble': () => import('./block-tumble'),
  'gem-cascade': () => import('./gem-cascade'),
  'bomb-catcher': () => import('./bomb-catcher'),
  'road-hopper': () => import('./road-hopper'),
  'echo-tones': () => import('./echo-tones'),
  'neon-trails': () => import('./neon-trails'),
  'pixel-pong-pro': () => import('./pixel-pong-pro'),
  'sky-ace-88': () => import('./sky-ace-88'),
  'cavern-raid': () => import('./cavern-raid'),
  'beam-lancer': () => import('./beam-lancer'),
  'orbit-raider': () => import('./orbit-raider'),
  'ghost-grid': () => import('./ghost-grid'),
  'pellet-pursuit': () => import('./pellet-pursuit'),
  'paint-patrol': () => import('./paint-patrol'),
  'segment-snap': () => import('./segment-snap'),
  'cube-hopper': () => import('./cube-hopper'),
  'crate-shift': () => import('./crate-shift'),
  'turbo-tunnel': () => import('./turbo-tunnel'),
  'dune-buggy-dash': () => import('./dune-buggy-dash'),
  'highway-hero': () => import('./highway-hero'),
  'bot-blitz': () => import('./bot-blitz'),
  'core-crusher': () => import('./core-crusher'),
  'sky-circuit': () => import('./sky-circuit'),
  'jungle-dash': () => import('./jungle-dash'),
  'sprint-masher': () => import('./sprint-masher'),
  'blast-grid': () => import('./blast-grid'),
  'pit-panic': () => import('./pit-panic'),
};

export function playableSlugs(): string[] {
  return Object.keys(loaders);
}

export function isPlayable(slug: string): boolean {
  return slug in loaders;
}

export async function loadGame(slug: string): Promise<GameDefinition<any> | null> {
  const loader = loaders[slug];
  return loader ? (await loader()).default : null;
}
