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
  game('ghost-grid', 'Ghost Grid', 'Maze', 860000, {
    description: 'Eat every pellet in a fresh maze while four ghosts hunt you; power pellets turn the tables.',
    touch: { a: 'Start', b: 'Alt' },
    controls: [{ keys: ['◀', '▶', '▲', '▼'], label: 'Steer' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('gravity-hop', 'Gravity Hop', 'Platform', 2_400_000),
  game('block-tumble', 'Block Tumble', 'Puzzle', 540_000, {
    description: 'Rotate and place falling blocks to clear full lines.',
    touch: { a: 'Drop', b: 'Rotate' },
    controls: [{ keys: ['◀', '▶'], label: 'Move' }, { keys: ['▲'], label: 'Rotate' }, { keys: ['▼'], label: 'Soft drop' }, { keys: ['Space'], label: 'Hard drop' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('turbo-tunnel', 'Turbo Tunnel', 'Racing', 310000, {
    description: 'Race through a dark tunnel with tight curves and heavy traffic against the clock.',
    touch: { a: 'Gas', b: 'Brake' },
    controls: [{ keys: ['◀', '▶'], label: 'Steer' }, { keys: ['▲', 'Space'], label: 'Accelerate' }, { keys: ['▼', 'X'], label: 'Brake' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('moon-miner', 'Moon Miner', 'Classic', 1_900_000),
  game('laser-lanes', 'Laser Lanes', 'Shooter', 720_000),
  game('pixel-pong-pro', 'Pixel Pong Pro', 'Sports', 95_000, {
    description: 'Rally the ball past a computer paddle that gets quicker every level.',
    touch: { a: 'Fire', b: 'Alt' },
    controls: [{ keys: ['▲', '▼'], label: 'Move paddle' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('sky-ace-88', 'Sky Ace 88', 'Shooter', 1100000, {
    description: 'Dogfight waves of planes and gunships, grab weapon pickups and survive the scroll.',
    touch: { a: 'Fire', b: 'Alt' },
    controls: [{ keys: ['◀', '▶', '▲', '▼'], label: 'Fly' }, { keys: ['Space'], label: 'Fire (hold)' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('crate-quest', 'Crate Quest', 'Platform', 430_000),
  game('neon-knuckles', 'Neon Knuckles', 'Fighting', 650_000),
  game('orbit-pinball', 'Orbit Pinball', 'Pinball', 280_000),
  game('lava-ladders', 'Lava Ladders', 'Platform', 390_000),
  game('gem-cascade', 'Gem Cascade', 'Puzzle', 1_400_000, {
    description: 'Line up three or more gems in any direction; chains multiply your score.',
    touch: { a: 'Swap', b: 'Swap back' },
    controls: [{ keys: ['◀', '▶'], label: 'Move' }, { keys: ['▲', 'Space'], label: 'Cycle gems' }, { keys: ['▼'], label: 'Soft drop' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('dune-buggy-dash', 'Dune Buggy Dash', 'Racing', 210000, {
    description: 'Drive a sunny desert road with long sweeping curves before time runs out.',
    touch: { a: 'Gas', b: 'Brake' },
    controls: [{ keys: ['◀', '▶'], label: 'Steer' }, { keys: ['▲', 'Space'], label: 'Accelerate' }, { keys: ['▼', 'X'], label: 'Brake' }, { keys: ['P'], label: 'Pause' }],
  }),
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
  game('cavern-raid', 'Cavern Raid', 'Shooter', 600000, {
    description: 'Fly over scrolling terrain, shoot turrets and fuel tanks, and never run dry or crash.',
    touch: { a: 'Fire', b: 'Alt' },
    controls: [{ keys: ['◀', '▶', '▲', '▼'], label: 'Fly' }, { keys: ['Space'], label: 'Fire (hold)' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('beam-lancer', 'Beam Lancer', 'Shooter', 520000, {
    description: 'Tap to shoot, hold to charge a piercing beam.',
    touch: { a: 'Fire', b: 'Alt' },
    controls: [{ keys: ['◀', '▶', '▲', '▼'], label: 'Fly' }, { keys: ['Space'], label: 'Tap = shot, hold = charge beam' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('orbit-raider', 'Orbit Raider', 'Shooter', 480000, {
    description: 'Collect pickups to upgrade your shot, then gain trailing option orbs that fire with you.',
    touch: { a: 'Fire', b: 'Alt' },
    controls: [{ keys: ['◀', '▶', '▲', '▼'], label: 'Fly' }, { keys: ['Space'], label: 'Fire (hold)' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('pellet-pursuit', 'Pellet Pursuit', 'Maze', 610000, {
    description: 'A wilder maze chase: ghosts wander unpredictably and the bonus fruit roams.',
    touch: { a: 'Start', b: 'Alt' },
    controls: [{ keys: ['◀', '▶', '▲', '▼'], label: 'Steer' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('paint-patrol', 'Paint Patrol', 'Maze', 300000, {
    description: 'Paint every line of the grid to fill the boxes while patrolling enemies roam.',
    touch: { a: 'Jump', b: 'Alt' },
    controls: [{ keys: ['◀', '▶', '▲', '▼'], label: 'Move along lines' }, { keys: ['Space'], label: 'Jump (3 per level)' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('segment-snap', 'Segment Snap', 'Shooter', 640000, {
    description: 'Blast a centipede of segments snaking down through a mushroom field.',
    touch: { a: 'Fire', b: 'Alt' },
    controls: [{ keys: ['◀', '▶', '▲', '▼'], label: 'Move' }, { keys: ['Space'], label: 'Fire' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('cube-hopper', 'Cube Hopper', 'Platform', 700000, {
    description: 'Hop diagonally across a pyramid to colour every cube while foes bounce down.',
    touch: { a: 'Start', b: 'Alt' },
    controls: [{ keys: ['◀', '▶', '▲', '▼'], label: 'Hop on the four diagonals' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('crate-shift', 'Crate Shift', 'Puzzle', 350000, {
    description: 'Push every crate onto a goal in as few moves as you can.',
    touch: { a: 'Start', b: 'Undo' },
    controls: [{ keys: ['◀', '▶', '▲', '▼'], label: 'Move / push' }, { keys: ['B'], label: 'Undo' }, { keys: ['Enter'], label: 'Restart level' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('highway-hero', 'Highway Hero', 'Racing', 280000, {
    description: 'Dodge traffic and oil slicks, refuel on the move and reach the goal.',
    touch: { a: 'Gas', b: 'Brake' },
    controls: [{ keys: ['◀', '▶'], label: 'Steer' }, { keys: ['▲', 'Space'], label: 'Accelerate' }, { keys: ['▼', 'X'], label: 'Brake' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('bot-blitz', 'Bot Blitz', 'Shooter', 540000, {
    description: 'Run and gun through an arena swarming with chasing robots.',
    touch: { a: 'Fire', b: 'Alt' },
    controls: [{ keys: ['◀', '▶', '▲', '▼'], label: 'Move (8-way)' }, { keys: ['Space'], label: 'Fire in your facing direction' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('core-crusher', 'Core Crusher', 'Shooter', 430000, {
    description: 'Shoot gaps through three rotating shields to hit the cannon at the core.',
    touch: { a: 'Fire', b: 'Thrust' },
    controls: [{ keys: ['◀', '▶'], label: 'Rotate' }, { keys: ['▲'], label: 'Thrust' }, { keys: ['Space'], label: 'Fire' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('sky-circuit', 'Sky Circuit', 'Shooter', 390000, {
    description: 'Loop through the sky in a dogfight, then take down the stage boss.',
    touch: { a: 'Fire', b: 'Alt' },
    controls: [{ keys: ['◀', '▶'], label: 'Turn' }, { keys: ['Space'], label: 'Fire (hold)' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('jungle-dash', 'Jungle Dash', 'Platform', 420000, {
    description: 'Sprint through the jungle, leaping logs, pits and scorpions to grab gems.',
    touch: { a: 'Jump', b: 'Alt' },
    controls: [{ keys: ['Space', '▲'], label: 'Jump' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('sprint-masher', 'Sprint Masher', 'Sports', 260000, {
    description: 'Mash left and right to sprint, then clear the hurdles in a qualifying race.',
    touch: { a: 'Jump', b: 'Alt' },
    controls: [{ keys: ['◀', '▶'], label: 'Alternate to run' }, { keys: ['Space'], label: 'Jump (hurdles)' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('blast-grid', 'Blast Grid', 'Maze', 500000, {
    description: 'Plant bombs to blast through blocks and take out every roaming creature.',
    touch: { a: 'Bomb', b: 'Alt' },
    controls: [{ keys: ['◀', '▶', '▲', '▼'], label: 'Move' }, { keys: ['Space'], label: 'Place bomb' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('pit-panic', 'Pit Panic', 'Platform', 240000, {
    description: 'Dig traps in the floor, then whack the monsters that fall in.',
    touch: { a: 'Dig', b: 'Alt' },
    controls: [{ keys: ['◀', '▶'], label: 'Walk' }, { keys: ['▲', '▼'], label: 'Climb ladders' }, { keys: ['Space'], label: 'Dig / whack' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('hive-strike', 'Hive Strike', 'Shooter', 760000, {
    description: 'Shoot the swooping swarm, dodge boss tractor beams and win back your ship for double firepower.',
    touch: { a: 'Fire', b: 'Alt' },
    controls: [{ keys: ['◀', '▶'], label: 'Move' }, { keys: ['Space'], label: 'Fire (hold)' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('ring-runner', 'Ring Runner', 'Shooter', 680000, {
    description: 'Orbit the rim of the screen and fire inward at beetles spiralling out of the centre.',
    touch: { a: 'Fire', b: 'Alt' },
    controls: [{ keys: ['◀', '▶'], label: 'Orbit' }, { keys: ['Space'], label: 'Fire (hold)' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('ember-wing', 'Ember Wing', 'Shooter', 520000, {
    description: 'Shoot swooping firebirds, shield against bombs, then break open the mothership.',
    touch: { a: 'Fire', b: 'Shield' },
    controls: [{ keys: ['◀', '▶'], label: 'Move' }, { keys: ['Space'], label: 'Fire' }, { keys: ['X'], label: 'Shield' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('web-warden', 'Web Warden', 'Shooter', 470000, {
    description: 'Ride the rim of a circular web and blast the climbers coming up the lanes.',
    touch: { a: 'Fire', b: 'Zap' },
    controls: [{ keys: ['◀', '▶'], label: 'Move lane' }, { keys: ['Space'], label: 'Fire' }, { keys: ['X'], label: 'Zapper' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('line-weaver', 'Line Weaver', 'Maze', 330000, {
    description: 'Draw lines to wall off territory while a spinning line and wall-crawling sparks hunt you.',
    touch: { a: 'Draw', b: 'Alt' },
    controls: [{ keys: ['◀', '▶', '▲', '▼'], label: 'Move' }, { keys: ['Space'], label: 'Draw (hold)' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('robo-maze', 'Robo Maze', 'Maze', 300000, {
    description: 'Blast robots in a maze of rooms and leave before the smiley pursuer finds you.',
    touch: { a: 'Fire', b: 'Alt' },
    controls: [{ keys: ['◀', '▶', '▲', '▼'], label: 'Move' }, { keys: ['Space'], label: 'Fire (faces last move)' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('lance-flyers', 'Lance Flyers', 'Platform', 360000, {
    description: 'Flap above rivals to win the joust and collect their eggs before they hatch.',
    touch: { a: 'Flap', b: 'Alt' },
    controls: [{ keys: ['◀', '▶'], label: 'Steer' }, { keys: ['Space', '▲'], label: 'Flap' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('night-lane', 'Night Lane', 'Racing', 240000, {
    description: 'Race a pitch-black road lit only by reflectors and headlights against the clock.',
    touch: { a: 'Gas', b: 'Brake' },
    controls: [{ keys: ['◀', '▶'], label: 'Steer' }, { keys: ['▲', 'Space'], label: 'Accelerate' }, { keys: ['▼', 'X'], label: 'Brake' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('tunnel-tinker', 'Tunnel Tinker', 'Maze', 380000, {
    description: 'Dig tunnels, pump underground monsters until they pop and drop rocks on the rest.',
    touch: { a: 'Pump', b: 'Alt' },
    controls: [{ keys: ['◀', '▶', '▲', '▼'], label: 'Dig / move' }, { keys: ['Space'], label: 'Pump (hold)' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('rally-maze', 'Rally Maze', 'Racing', 290000, {
    description: 'Race a maze for flags while rival cars hunt you and a smoke screen stalls them.',
    touch: { a: 'Alt', b: 'Smoke' },
    controls: [{ keys: ['◀', '▶', '▲', '▼'], label: 'Steer' }, { keys: ['X'], label: 'Smoke screen' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('tile-catcher', 'Tile Catcher', 'Puzzle', 410000, {
    description: 'Catch coloured tiles on a paddle and stack them in a bin to line up three of a colour.',
    touch: { a: 'Toss', b: 'Drop' },
    controls: [{ keys: ['◀', '▶'], label: 'Move paddle' }, { keys: ['Space', '▲'], label: 'Toss tile' }, { keys: ['X', '▼'], label: 'Drop to bin' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('lunar-rover', 'Lunar Rover', 'Shooter', 350000, {
    description: 'Hop craters, shoot boulders and alien bombers while a lunar rover races across the moon.',
    touch: { a: 'Jump', b: 'Fire' },
    controls: [{ keys: ['◀', '▶'], label: 'Speed up / slow' }, { keys: ['Space', '▲'], label: 'Jump' }, { keys: ['X'], label: 'Fire forward + up' }, { keys: ['P'], label: 'Pause' }],
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
