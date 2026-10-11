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
  game('capsule-clinic', 'Capsule Clinic', 'Puzzle', 430_000, {
    description: 'Drop two-colour capsules into the bottle and line up four of a colour to wipe out every germ.',
    touch: { a: 'Rotate', b: 'Rotate back' },
    controls: [{ keys: ['◀', '▶'], label: 'Move' }, { keys: ['▲', 'Space'], label: 'Rotate' }, { keys: ['X'], label: 'Rotate back' }, { keys: ['▼'], label: 'Soft drop' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('jelly-pop', 'Jelly Pop', 'Puzzle', 510_000, {
    description: 'Stack falling jelly pairs and connect four or more of a colour to pop them. Chain pops for huge scores.',
    touch: { a: 'Rotate', b: 'Rotate back' },
    controls: [{ keys: ['◀', '▶'], label: 'Move' }, { keys: ['▲', 'Space'], label: 'Rotate' }, { keys: ['X'], label: 'Rotate back' }, { keys: ['▼'], label: 'Soft drop' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('grid-tanker', 'Grid Tanker', 'Shooter', 620_000, {
    description: 'Command a wireframe tank on a neon plain. Use the radar, hide behind blocks and out-aim enemy tanks and missiles.',
    touch: { a: 'Fire', b: 'Fire' },
    controls: [{ keys: ['◀', '▶'], label: 'Turn' }, { keys: ['▲', '▼'], label: 'Drive / reverse' }, { keys: ['Space'], label: 'Fire' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('outpost-raid', 'Outpost Raid', 'Shooter', 470_000, {
    description: 'Fly in eight directions over a wrapping star map, blast gun pods and slip shots into enemy base cores.',
    touch: { a: 'Fire', b: 'Fire' },
    controls: [{ keys: ['◀', '▶', '▲', '▼'], label: 'Steer (8-way)' }, { keys: ['Space'], label: 'Fire ahead and astern' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('frost-shover', 'Frost Shover', 'Maze', 450_000, {
    description: 'Slide ice blocks to crush the creatures hunting you. Line up the three gold blocks for a big bonus.',
    touch: { a: 'Push', b: 'Push' },
    controls: [{ keys: ['◀', '▶', '▲', '▼'], label: 'Move / push block' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('garden-gates', 'Garden Gates', 'Maze', 380_000, {
    description: 'Eat every dot in a hedge maze. Push the swinging gates open, then let them slam shut on the bugs behind you.',
    touch: { a: 'Start', b: 'Alt' },
    controls: [{ keys: ['◀', '▶', '▲', '▼'], label: 'Move / push gate' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('orchard-digger', 'Orchard Digger', 'Maze', 520_000, {
    description: 'Dig tunnels, pick every cherry and drop apples on the grubs. A bouncing power ball keeps them at bay.',
    touch: { a: 'Ball', b: 'Ball' },
    controls: [{ keys: ['◀', '▶', '▲', '▼'], label: 'Dig / move' }, { keys: ['Space'], label: 'Throw ball' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('crypt-crawler', 'Crypt Crawler', 'Maze', 410_000, {
    description: 'Prowl a monster-filled dungeon, watch the radar and shoot first. Yellow monsters are invisible until close.',
    touch: { a: 'Fire', b: 'Fire' },
    controls: [{ keys: ['◀', '▶', '▲', '▼'], label: 'Move' }, { keys: ['Space'], label: 'Fire' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('orb-popper', 'Orb Popper', 'Puzzle', 640_000, {
    description: 'Aim and bounce glowing orbs into the cluster. Match three to pop them and cut off hanging orbs for a cascade.',
    touch: { a: 'Fire', b: 'Swap' },
    controls: [{ keys: ['◀', '▶'], label: 'Aim' }, { keys: ['Space', '▲'], label: 'Fire' }, { keys: ['X'], label: 'Swap orb' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('crystal-quarry', 'Crystal Quarry', 'Puzzle', 490_000, {
    description: 'Dig through a cave, collect crystals and dodge falling boulders and wall-hugging fireflies before time runs out.',
    touch: { a: 'Action', b: 'Alt' },
    controls: [{ keys: ['◀', '▶', '▲', '▼'], label: 'Dig / move / push' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('vault-delver', 'Vault Delver', 'Shooter', 560_000, {
    description: 'Shoot your way through a monster-filled dungeon, smash the spawners, grab the key and escape the vault. Health drains as you go.',
    touch: { a: 'Fire', b: 'Potion' },
    controls: [{ keys: ['◀', '▶', '▲', '▼'], label: 'Move (8-way)' }, { keys: ['Space'], label: 'Shoot (hold)' }, { keys: ['X'], label: 'Potion' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('skyline-stomper', 'Skyline Stomper', 'Shooter', 430_000, {
    description: 'Climb the towers, smash every window and flatten the city while tanks, choppers and snipers fight back.',
    touch: { a: 'Punch', b: 'Alt' },
    controls: [{ keys: ['◀', '▶'], label: 'Walk / climb sideways' }, { keys: ['▲', '▼'], label: 'Climb' }, { keys: ['Space'], label: 'Punch' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('tilt-track', 'Tilt Track', 'Racing', 580_000, {
    description: 'Steer a marble down winding isometric slopes against the clock. Fall off and lose time; dodge the steel marbles.',
    touch: { a: 'Action', b: 'Alt' },
    controls: [{ keys: ['◀', '▶', '▲', '▼'], label: 'Roll (screen directions)' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('gold-raider', 'Gold Raider', 'Platform', 510_000, {
    description: 'Dig pits in the brick floors to trap the guards, grab every bar of gold, then climb the hidden ladder to escape.',
    touch: { a: 'Dig left', b: 'Dig right' },
    controls: [{ keys: ['◀', '▶', '▲', '▼'], label: 'Run / climb' }, { keys: ['Z'], label: 'Dig left' }, { keys: ['X'], label: 'Dig right' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('barrel-brute', 'Barrel Brute', 'Platform', 700_000, {
    description: 'Climb the crooked girders to the top while a giant brute rolls barrels at you. Hop them, or grab a hammer and smash them.',
    touch: { a: 'Jump', b: 'Jump' },
    controls: [{ keys: ['◀', '▶'], label: 'Run' }, { keys: ['▲', '▼'], label: 'Climb' }, { keys: ['Space'], label: 'Jump' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('pipe-bumper', 'Pipe Bumper', 'Platform', 660_000, {
    description: 'Bump the platforms from below to flip the creatures crawling on them, then kick them away. Hit the POW block to flip them all.',
    touch: { a: 'Jump', b: 'Jump' },
    controls: [{ keys: ['◀', '▶'], label: 'Run' }, { keys: ['Space', '▲'], label: 'Jump / bump' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('stack-chef', 'Stack Chef', 'Platform', 590_000, {
    description: 'Walk over the burger layers to drop them down the floors and build four burgers, while hungry foods chase you. Pepper stuns them.',
    touch: { a: 'Pepper', b: 'Pepper' },
    controls: [{ keys: ['◀', '▶'], label: 'Walk' }, { keys: ['▲', '▼'], label: 'Climb' }, { keys: ['Space'], label: 'Pepper' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('bomb-hopper', 'Bomb Hopper', 'Platform', 480_000, {
    description: 'Leap and glide around one big screen collecting every bomb. Grab the flashing one first for a bonus and dodge the patrols.',
    touch: { a: 'Jump / glide', b: 'Jump' },
    controls: [{ keys: ['◀', '▶'], label: 'Run' }, { keys: ['Space', '▲'], label: 'Jump (hold to glide)' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('spring-sneak', 'Spring Sneak', 'Platform', 430000, {
    description: 'Bounce between floors on trampolines, recover the stolen loot and use power doors to blast the chasing cats.',
    touch: { a: 'Action', b: 'Door' },
    controls: [{ keys: ['◀', '▶'], label: 'Walk' }, { keys: ['Space'], label: 'Open power door' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('roo-rescue', 'Roo Rescue', 'Platform', 520000, {
    description: 'Climb the floors to rescue your joey, punching the apples and monkeys in your way.',
    touch: { a: 'Punch', b: 'Jump' },
    controls: [{ keys: ['◀', '▶'], label: 'Run' }, { keys: ['▲', '▼'], label: 'Climb' }, { keys: ['X'], label: 'Jump' }, { keys: ['Space'], label: 'Punch' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('bubble-brawler', 'Bubble Brawler', 'Platform', 740000, {
    description: 'Blow bubbles to trap the monsters, pop them for fruit, and clear each round before the hurry-up ghost arrives.',
    touch: { a: 'Jump', b: 'Bubble' },
    controls: [{ keys: ['◀', '▶'], label: 'Run' }, { keys: ['Space', '▲'], label: 'Jump' }, { keys: ['X'], label: 'Blow bubble' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('lift-agent', 'Lift Agent', 'Platform', 450000, {
    description: 'Ride the elevators down a guarded tower, grab the secret documents behind the red doors and slip out. Duck to dodge shots.',
    touch: { a: 'Shoot', b: 'Jump' },
    controls: [{ keys: ['◀', '▶'], label: 'Walk' }, { keys: ['▲', '▼'], label: 'Elevator / enter door / duck' }, { keys: ['X'], label: 'Jump' }, { keys: ['Space'], label: 'Shoot' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('vine-climber', 'Vine Climber', 'Platform', 460000, {
    description: 'Swing between jungle vines to reach the key, shaking fruit down on the snapjaws that chase you.',
    touch: { a: 'Jump', b: 'Jump' },
    controls: [{ keys: ['◀', '▶'], label: 'Run' }, { keys: ['▲', '▼'], label: 'Climb vines' }, { keys: ['Space'], label: 'Jump' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('sailor-slugger', 'Sailor Slugger', 'Platform', 400000, {
    description: 'Catch the hearts drifting down to the sea while a big bruiser hunts you. Grab spinach and punch him into the water.',
    touch: { a: 'Punch', b: 'Punch' },
    controls: [{ keys: ['◀', '▶'], label: 'Run' }, { keys: ['▲', '▼'], label: 'Stairs' }, { keys: ['Space'], label: 'Punch' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('canopy-climb', 'Canopy Climb', 'Platform', 390000, {
    description: 'Scale a winding isometric cliff toward the ape, hopping the coconuts he rolls down at you.',
    touch: { a: 'Hop', b: 'Hop' },
    controls: [{ keys: ['◀', '▶', '▲', '▼'], label: 'Move (screen directions)' }, { keys: ['Space'], label: 'Hop' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('planet-patrol', 'Planet Patrol', 'Shooter', 900000, {
    description: 'Patrol a long wrapping planet, shoot the landers before they abduct the humanoids, and catch any that fall.',
    touch: { a: 'Fire', b: 'Smart bomb' },
    controls: [{ keys: ['◀', '▶'], label: 'Thrust / turn' }, { keys: ['▲', '▼'], label: 'Altitude' }, { keys: ['Space'], label: 'Fire' }, { keys: ['X'], label: 'Smart bomb' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('portal-patrol', 'Portal Patrol', 'Shooter', 610000, {
    description: 'The planet patrol continues with mine-laying bombers and pods that burst into swarmers. Shoot the mines to clear a path.',
    touch: { a: 'Fire', b: 'Smart bomb' },
    controls: [{ keys: ['◀', '▶'], label: 'Thrust / turn' }, { keys: ['▲', '▼'], label: 'Altitude' }, { keys: ['Space'], label: 'Fire' }, { keys: ['X'], label: 'Smart bomb' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('zone-striker', 'Zone Striker', 'Shooter', 530000, {
    description: 'Shoot air raiders and bomb the ground installations through the crosshair ahead of you, then take down the fortress.',
    touch: { a: 'Fire', b: 'Bomb' },
    controls: [{ keys: ['◀', '▶', '▲', '▼'], label: 'Fly' }, { keys: ['Space'], label: 'Shoot air' }, { keys: ['X'], label: 'Bomb ground' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('altitude-raid', 'Altitude Raid', 'Shooter', 580000, {
    description: 'Fly an isometric fortress run: climb and dive through wall gaps, shoot fuel tanks to refuel, and fire low at ground turrets.',
    touch: { a: 'Fire', b: 'Alt' },
    controls: [{ keys: ['◀', '▶'], label: 'Steer' }, { keys: ['▲', '▼'], label: 'Climb / dive' }, { keys: ['Space'], label: 'Fire' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('peak-climber', 'Peak Climber', 'Platform', 540000, {
    description: 'Jump up through the brick floors to climb the mountain, hammering seals and birds on the way to the summit.',
    touch: { a: 'Hammer', b: 'Jump' },
    controls: [{ keys: ['◀', '▶'], label: 'Walk' }, { keys: ['X', '▲'], label: 'Jump (knocks bricks out)' }, { keys: ['Space'], label: 'Hammer' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('disc-warrior', 'Disc Warrior', 'Platform', 470000, {
    description: 'Run through a hostile land swinging a spinning disc on a tether to cut down everything ahead of you.',
    touch: { a: 'Disc', b: 'Jump' },
    controls: [{ keys: ['◀', '▶'], label: 'Run' }, { keys: ['X', '▲'], label: 'Jump' }, { keys: ['Space'], label: 'Disc attack' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('fruit-runner', 'Fruit Runner', 'Platform', 610000, {
    description: 'Race across an island hurling hatchets, keeping your energy up by grabbing fruit before it runs out.',
    touch: { a: 'Throw', b: 'Jump' },
    controls: [{ keys: ['◀', '▶'], label: 'Run' }, { keys: ['X', '▲'], label: 'Jump' }, { keys: ['Space'], label: 'Throw hatchet' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('grave-knight', 'Grave Knight', 'Platform', 500000, {
    description: 'Fight through a haunted graveyard throwing lances. Your armour takes the first hit; the second one kills.',
    touch: { a: 'Lance', b: 'Jump' },
    controls: [{ keys: ['◀', '▶'], label: 'Walk' }, { keys: ['X', '▲'], label: 'Jump' }, { keys: ['Space'], label: 'Throw lance' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('deep-delver', 'Deep Delver', 'Platform', 380000, {
    description: 'Descend a cave on ropes before your air runs out. Any fall of more than three tiles is fatal, and a ghost hunts you; flares drive it off.',
    touch: { a: 'Flare', b: 'Jump' },
    controls: [{ keys: ['◀', '▶'], label: 'Walk' }, { keys: ['▲', '▼'], label: 'Climb ropes' }, { keys: ['X'], label: 'Jump' }, { keys: ['Space'], label: 'Flare' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('jungle-spitter', 'Jungle Spitter', 'Platform', 420000, {
    description: 'Bounce through the jungle as an ape who spits fireballs, with huge jumps over hopping and flying enemies.',
    touch: { a: 'Spit', b: 'Jump' },
    controls: [{ keys: ['◀', '▶'], label: 'Run' }, { keys: ['X', '▲'], label: 'Jump' }, { keys: ['Space'], label: 'Spit' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('shadow-agent', 'Shadow Agent', 'Shooter', 440000, {
    description: 'Fight through the enemy base with a limited pistol. Slip through doors to restock your ammunition.',
    touch: { a: 'Fire', b: 'Jump' },
    controls: [{ keys: ['◀', '▶'], label: 'Walk' }, { keys: ['X'], label: 'Jump' }, { keys: ['Space'], label: 'Fire' }, { keys: ['▲'], label: 'Enter door (restock)' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('ninja-strike', 'Ninja Strike', 'Platform', 560000, {
    description: 'Throw shuriken at range, slash anything that gets close, and free the hostages before the boss at the end.',
    touch: { a: 'Strike', b: 'Jump' },
    controls: [{ keys: ['◀', '▶'], label: 'Run' }, { keys: ['X', '▲'], label: 'Jump' }, { keys: ['Space'], label: 'Shuriken / sword' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('jungle-commando', 'Jungle Commando', 'Shooter', 640000, {
    description: 'Run and gun through the jungle: aim in eight directions, lie flat to dodge bullets and grab the spread gun. One hit and you are down.',
    touch: { a: 'Fire', b: 'Jump' },
    controls: [{ keys: ['◀', '▶', '▲', '▼'], label: 'Run / aim' }, { keys: ['X'], label: 'Jump' }, { keys: ['Space', 'Z'], label: 'Fire (hold)' }, { keys: ['▼'], label: 'Lie flat on the ground' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('back-alley-brawl', 'Back-Alley Brawl', 'Fighting', 610000, {
    description: 'Fight through the alley in a three-hit combo, jump-kick, and grab knives and bats before the boss at the end of each stage.',
    touch: { a: 'Punch', b: 'Jump' },
    controls: [{ keys: ['◀', '▶', '▲', '▼'], label: 'Move' }, { keys: ['Space', 'Z'], label: 'Punch combo / jump kick' }, { keys: ['X'], label: 'Jump' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('metro-rumble', 'Metro Rumble', 'Fighting', 590000, {
    description: 'Clear the subway streets with heavy punches. Down plus punch is a spin that clears the crowd but costs health.',
    touch: { a: 'Punch', b: 'Jump' },
    controls: [{ keys: ['◀', '▶', '▲', '▼'], label: 'Move' }, { keys: ['Space', 'Z'], label: 'Punch combo' }, { keys: ['▼', 'Space'], label: 'Spin (costs health)' }, { keys: ['X'], label: 'Jump' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('sunblade-saga', 'Sunblade Saga', 'Fighting', 570000, {
    description: 'A long-reach blade fighter: smash crates for magic pots and press Up plus attack to scorch everything on screen.',
    touch: { a: 'Slash', b: 'Jump' },
    controls: [{ keys: ['◀', '▶', '▲', '▼'], label: 'Move' }, { keys: ['Space', 'Z'], label: 'Slash combo' }, { keys: ['▲', 'Space'], label: 'Magic (uses pots)' }, { keys: ['X'], label: 'Jump' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('tower-monk', 'Tower Monk', 'Fighting', 530000, {
    description: 'Climb the tower along a single corridor: shake off grippers, duck high knives, jump low ones, and beat the floor boss.',
    touch: { a: 'Strike', b: 'Jump' },
    controls: [{ keys: ['◀', '▶'], label: 'Walk' }, { keys: ['▼'], label: 'Duck' }, { keys: ['Space', 'Z'], label: 'Strike' }, { keys: ['X'], label: 'Jump' }, { keys: ['◀', '▶'], label: 'Mash to break a grab' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('field-commando', 'Field Commando', 'Shooter', 520000, {
    description: 'Advance up the field on foot, shooting in eight directions and lobbing grenades over cover. One hit and you are down.',
    touch: { a: 'Fire', b: 'Grenade' },
    controls: [{ keys: ['◀', '▶', '▲', '▼'], label: 'Move / aim' }, { keys: ['Space', 'Z'], label: 'Fire (hold)' }, { keys: ['X'], label: 'Grenade (lobs over cover)' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('iron-trooper', 'Iron Trooper', 'Shooter', 500000, {
    description: 'Push up the battlefield, commandeer tanks that soak up four hits, and storm the fortress at the end of each stage.',
    touch: { a: 'Fire', b: 'Grenade' },
    controls: [{ keys: ['◀', '▶', '▲', '▼'], label: 'Move / aim' }, { keys: ['Space', 'Z'], label: 'Fire (hold)' }, { keys: ['X'], label: 'Grenade (lobs over cover)' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('road-agent', 'Road Agent', 'Racing', 480000, {
    description: 'Drive a gun-armed car down a winding road: shoot hostile cars, spare the civilians, and pick up missiles from weapon vans.',
    touch: { a: 'Guns', b: 'Missile' },
    controls: [{ keys: ['◀', '▶'], label: 'Steer' }, { keys: ['▲'], label: 'Faster' }, { keys: ['▼'], label: 'Brake' }, { keys: ['Space', 'Z'], label: 'Machine gun (hold)' }, { keys: ['X'], label: 'Missile' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('ridge-rider', 'Ridge Rider', 'Racing', 450000, {
    description: 'Lean a superbike through long coastal bends, weave through traffic and beat the checkpoint clock.',
    touch: { a: 'Gas', b: 'Brake' },
    controls: [{ keys: ['◀', '▶'], label: 'Lean / steer' }, { keys: ['▲', 'Space'], label: 'Accelerate' }, { keys: ['▼', 'X'], label: 'Brake' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('sprint-circuit', 'Sprint Circuit', 'Racing', 430000, {
    description: 'A single-screen circuit with three rivals: slide through the bends, dodge oil, grab wrenches and finish in the top two.',
    touch: { a: 'Gas', b: 'Brake' },
    controls: [{ keys: ['◀', '▶'], label: 'Steer' }, { keys: ['▲', 'Space'], label: 'Accelerate' }, { keys: ['▼', 'X'], label: 'Brake' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('bounce-buggy', 'Bounce Buggy', 'Racing', 410000, {
    description: 'Bounce down the road: leap the water, land on rivals to squash them and shoulder them off the edge.',
    touch: { a: 'Big jump', b: 'Big jump' },
    controls: [{ keys: ['◀', '▶'], label: 'Steer' }, { keys: ['▲'], label: 'Faster' }, { keys: ['▼'], label: 'Brake' }, { keys: ['Space', 'Z'], label: 'Big jump (as you land)' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('arena-masters', 'Arena Masters', 'Fighting', 400000, {
    description: 'Square off one-on-one: punches, kicks, sweeps and a fireball (Down, Forward, Punch). Win two rounds against a ladder of tougher fighters.',
    touch: { a: 'Punch', b: 'Kick' },
    controls: [{ keys: ['◀', '▶'], label: 'Walk (hold back to block)' }, { keys: ['▲'], label: 'Jump' }, { keys: ['▼'], label: 'Crouch' }, { keys: ['Space', 'Z'], label: 'Punch' }, { keys: ['X'], label: 'Kick (crouching: sweep)' }, { keys: ['▼', '▶', 'Space'], label: 'Fireball' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('dojo-duel', 'Dojo Duel', 'Fighting', 380000, {
    description: 'A karate duel scored in points: the first clean hit wins the exchange; first to four takes the round.',
    touch: { a: 'Punch', b: 'Kick' },
    controls: [{ keys: ['◀', '▶'], label: 'Walk (hold back to block)' }, { keys: ['▲'], label: 'Jump' }, { keys: ['▼'], label: 'Crouch' }, { keys: ['Space', 'Z'], label: 'Punch' }, { keys: ['X'], label: 'Kick (crouching: sweep)' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('glove-rush', 'Glove Rush', 'Fighting', 360000, {
    description: 'Read the wind-up, lean away from the glove, counter while he is open, and spend stars on an uppercut.',
    touch: { a: 'Head punch', b: 'Body punch' },
    controls: [{ keys: ['◀', '▶'], label: 'Lean away from the glove' }, { keys: ['▼'], label: 'Block (hold)' }, { keys: ['Space', 'Z'], label: 'Punch head (with ▲ and a star: uppercut)' }, { keys: ['X'], label: 'Punch body' }, { keys: ['Space'], label: 'Mash to get up from a knockdown' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('route-rider', 'Route Rider', 'Racing', 350000, {
    description: 'Ride down the street throwing papers into mailboxes, smashing windows of non-subscribers, and dodging cars, dogs and potholes.',
    touch: { a: 'Throw left', b: 'Throw right' },
    controls: [{ keys: ['◀', '▶'], label: 'Steer' }, { keys: ['▲', '▼'], label: 'Faster / slower' }, { keys: ['Space'], label: 'Throw left' }, { keys: ['X'], label: 'Throw right' }, { keys: ['P'], label: 'Pause' }],
  }),
  game('dirt-rider', 'Dirt Rider', 'Racing', 460000, {
    description: 'Race a dirt bike over ramps and hurdles. Watch the temperature gauge, and level the bike before you land.',
    touch: { a: 'Gas', b: 'Turbo' },
    controls: [{ keys: ['Space'], label: 'Throttle' }, { keys: ['X'], label: 'Turbo (heats the engine)' }, { keys: ['▲', '▼'], label: 'Change lane / tilt in the air' }, { keys: ['P'], label: 'Pause' }],
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
export * from './api';
