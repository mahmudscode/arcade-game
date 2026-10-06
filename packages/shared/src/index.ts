export type Category = 'Shooter' | 'Maze' | 'Platform' | 'Puzzle' | 'Racing' | 'Sports' | 'Fighting' | 'Pinball' | 'Classic';

export interface GameMeta {
  slug: string;
  title: string;
  category: Category;
  plays: number;
  players: string;
  rating: number;
  ratingCount: number;
  description: string;
  controls: { keys: string[]; label: string }[];
  /** Labels for the on-screen A / B buttons on touch devices. */
  touch: { a: string; b: string };
}

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'Shooter', label: 'Shooters' },
  { id: 'Maze', label: 'Maze' },
  { id: 'Platform', label: 'Platform' },
  { id: 'Puzzle', label: 'Puzzle' },
  { id: 'Racing', label: 'Racing' },
  { id: 'Sports', label: 'Sports' },
  { id: 'Fighting', label: 'Fighting' },
  { id: 'Pinball', label: 'Pinball' },
  { id: 'Classic', label: 'Classics' },
];

const DEFAULT_CONTROLS = [
  { keys: ['◀', '▶'], label: 'Move' },
  { keys: ['Space'], label: 'Action' },
  { keys: ['P'], label: 'Pause' },
];

function game(slug: string, title: string, category: Category, plays: number, extra: Partial<GameMeta> = {}): GameMeta {
  return {
    slug,
    title,
    category,
    plays,
    players: '1 player',
    rating: 4.5,
    ratingCount: Math.round(plays / 100),
    description: '',
    controls: DEFAULT_CONTROLS,
    touch: { a: 'Action', b: 'Alt' },
    ...extra,
  };
}

/** Placeholder catalog (original titles from the design). Moves to the API/database in the backend milestone. */
export const GAMES: GameMeta[] = [
  game('comet-crusher', 'Comet Crusher', 'Shooter', 1_200_000, {
    rating: 4.8,
    ratingCount: 12_430,
    description: 'Blast drifting rocks before they split. 40 waves, saves your best run.',
    touch: { a: 'Fire', b: 'Thrust' },
    controls: [
      { keys: ['◀', '▶'], label: 'Rotate ship' },
      { keys: ['▲'], label: 'Thrust' },
      { keys: ['Space'], label: 'Fire' },
      { keys: ['P'], label: 'Pause' },
    ],
  }),
  game('ghost-grid', 'Ghost Grid', 'Maze', 860_000),
  game('gravity-hop', 'Gravity Hop', 'Platform', 2_400_000),
  game('block-tumble', 'Block Tumble', 'Puzzle', 540_000, {
    description: 'Rotate and place falling blocks to clear full lines.',
    touch: { a: 'Drop', b: 'Rotate' },
    controls: [{ keys: ['◀', '▶'], label: 'Move' }, { keys: ['▲'], label: 'Rotate' }, { keys: ['▼'], label: 'Soft drop' }, { keys: ['Space'], label: 'Hard drop' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('turbo-tunnel', 'Turbo Tunnel', 'Racing', 310_000),
  game('moon-miner', 'Moon Miner', 'Classic', 1_900_000),
  game('laser-lanes', 'Laser Lanes', 'Shooter', 720_000),
  game('pixel-pong-pro', 'Pixel Pong Pro', 'Sports', 95_000, {
    description: 'Rally the ball past a computer paddle that gets quicker every level.',
    touch: { a: 'Fire', b: 'Alt' },
    controls: [{ keys: ['▲', '▼'], label: 'Move paddle' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('sky-ace-88', 'Sky Ace 88', 'Shooter', 1_100_000),
  game('crate-quest', 'Crate Quest', 'Platform', 430_000),
  game('neon-knuckles', 'Neon Knuckles', 'Fighting', 650_000),
  game('orbit-pinball', 'Orbit Pinball', 'Pinball', 280_000),
  game('lava-ladders', 'Lava Ladders', 'Platform', 390_000),
  game('gem-cascade', 'Gem Cascade', 'Puzzle', 1_400_000, {
    description: 'Line up three or more gems in any direction; chains multiply your score.',
    touch: { a: 'Swap', b: 'Swap back' },
    controls: [{ keys: ['◀', '▶'], label: 'Move' }, { keys: ['▲', 'Space'], label: 'Cycle gems' }, { keys: ['▼'], label: 'Soft drop' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('dune-buggy-dash', 'Dune Buggy Dash', 'Racing', 210_000),
  game('hex-hunter', 'Hex Hunter', 'Maze', 610_000),
  game('robo-rumble', 'Robo Rumble', 'Fighting', 330_000),
  game('star-harvest', 'Star Harvest', 'Classic', 880_000),
  game('frost-fortress', 'Frost Fortress', 'Shooter', 470_000),
  game('bubble-burst', 'Bubble Burst', 'Puzzle', 1_000_000),
  game('hoop-blitz', 'Hoop Blitz', 'Sports', 150_000),
  game('cave-comet', 'Cave Comet', 'Classic', 260_000),
  game('tank-trails', 'Tank Trails', 'Maze', 520_000),
  game('saucer-swarm', 'Saucer Swarm', 'Shooter', 990_000, {
    description: 'Stop the marching saucer swarm before it lands. Hide behind shields, snipe the bonus UFO.',
    touch: { a: 'Fire', b: 'Alt' },
    controls: [
      { keys: ['◀', '▶'], label: 'Move' },
      { keys: ['Space'], label: 'Fire' },
      { keys: ['P'], label: 'Pause' },
    ],
  }),
  game('star-divers', 'Star Divers', 'Shooter', 640_000, {
    description: 'Shoot the hovering formation while single ships peel off and dive at you.',
    touch: { a: 'Fire', b: 'Alt' },
    controls: [{ keys: ['◀', '▶'], label: 'Move' }, { keys: ['Space'], label: 'Fire' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('sky-shield', 'Sky Shield', 'Shooter', 580_000, {
    description: 'Aim the crosshair and launch interceptors to protect your six cities.',
    touch: { a: 'Launch', b: 'Alt' },
    controls: [{ keys: ['◀', '▶', '▲', '▼'], label: 'Aim' }, { keys: ['Space'], label: 'Launch' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('lunar-descent', 'Lunar Descent', 'Classic', 410_000, {
    description: 'Rotate and thrust against gravity, then set down gently on a landing pad.',
    touch: { a: 'Thrust', b: 'Alt' },
    controls: [{ keys: ['◀', '▶'], label: 'Rotate' }, { keys: ['▲', 'Space'], label: 'Thrust' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('brick-bash', 'Brick Bash', 'Classic', 720000, {
    description: 'Bounce the ball off your paddle and smash every brick.',
    touch: { a: 'Launch', b: 'Alt' },
    controls: [{ keys: ['◀', '▶'], label: 'Move paddle' }, { keys: ['Space'], label: 'Launch' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('vault-breaker', 'Vault Breaker', 'Classic', 540000, {
    description: 'Break armoured bricks and catch capsules that widen, split or slow the ball.',
    touch: { a: 'Launch', b: 'Alt' },
    controls: [{ keys: ['◀', '▶'], label: 'Move paddle' }, { keys: ['Space'], label: 'Launch' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('neon-serpent', 'Neon Serpent', 'Classic', 1300000, {
    description: 'Steer a growing serpent to eat food without hitting a wall or yourself.',
    touch: { a: 'Start', b: 'Alt' },
    controls: [{ keys: ['◀', '▶', '▲', '▼'], label: 'Steer' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('bomb-catcher', 'Bomb Catcher', 'Classic', 460000, {
    description: 'Slide your buckets to catch every bomb the bomber drops.',
    touch: { a: 'Start', b: 'Alt' },
    controls: [{ keys: ['◀', '▶'], label: 'Move buckets' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('road-hopper', 'Road Hopper', 'Classic', 900000, {
    description: 'Hop across traffic and ride logs to reach the five home slots.',
    touch: { a: 'Start', b: 'Alt' },
    controls: [{ keys: ['◀', '▶', '▲', '▼'], label: 'Hop' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('echo-tones', 'Echo Tones', 'Puzzle', 350000, {
    description: 'Watch the pattern of coloured pads, then repeat it from memory.',
    touch: { a: 'Top', b: 'Bottom' },
    controls: [{ keys: ['◀', '▶', '▲', '▼'], label: 'Pick a pad' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('neon-trails', 'Neon Trails', 'Maze', 480000, {
    description: 'Race a light-trail cycle and trap the rival into a crash.',
    touch: { a: 'Start', b: 'Alt' },
    controls: [{ keys: ['◀', '▶', '▲', '▼'], label: 'Turn' }, { keys: ['P'], label: 'Pause' }],
  }),
];

export const FEATURED_SLUG = 'comet-crusher';

export function getGame(slug: string): GameMeta | undefined {
  return GAMES.find((g) => g.slug === slug);
}

export function formatPlays(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}
