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
  game('block-tumble', 'Block Tumble', 'Puzzle', 540_000),
  game('turbo-tunnel', 'Turbo Tunnel', 'Racing', 310_000),
  game('moon-miner', 'Moon Miner', 'Classic', 1_900_000),
  game('laser-lanes', 'Laser Lanes', 'Shooter', 720_000),
  game('pixel-pong-pro', 'Pixel Pong Pro', 'Sports', 95_000),
  game('sky-ace-88', 'Sky Ace 88', 'Shooter', 1_100_000),
  game('crate-quest', 'Crate Quest', 'Platform', 430_000),
  game('neon-knuckles', 'Neon Knuckles', 'Fighting', 650_000),
  game('orbit-pinball', 'Orbit Pinball', 'Pinball', 280_000),
  game('lava-ladders', 'Lava Ladders', 'Platform', 390_000),
  game('gem-cascade', 'Gem Cascade', 'Puzzle', 1_400_000),
  game('dune-buggy-dash', 'Dune Buggy Dash', 'Racing', 210_000),
  game('hex-hunter', 'Hex Hunter', 'Maze', 610_000),
  game('robo-rumble', 'Robo Rumble', 'Fighting', 330_000),
  game('star-harvest', 'Star Harvest', 'Classic', 880_000),
  game('frost-fortress', 'Frost Fortress', 'Shooter', 470_000),
  game('bubble-burst', 'Bubble Burst', 'Puzzle', 1_000_000),
  game('hoop-blitz', 'Hoop Blitz', 'Sports', 150_000),
  game('cave-comet', 'Cave Comet', 'Classic', 260_000),
  game('tank-trails', 'Tank Trails', 'Maze', 520_000),
  game('saucer-swarm', 'Saucer Swarm', 'Shooter', 990_000),
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
