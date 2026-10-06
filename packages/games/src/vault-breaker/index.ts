import { createBrickGame } from '../_shared/brick-breaker';

/** Arkanoid-style: shaped levels, armoured bricks and falling capsules. */
const PATTERNS: ((r: number, c: number) => number)[] = [
  () => 1,
  (r, c) => ((r + c) % 2 === 0 ? (r < 2 ? 2 : 1) : 0),
  (r, c) => (Math.abs(c - 5.5) + r <= 6 ? (r === 0 ? 2 : 1) : 0),
  (r, c) => (c % 3 === 1 ? 0 : r === 7 ? 2 : 1),
];

export default createBrickGame({
  id: 'vault-breaker',
  layout: (level, r, c) => PATTERNS[(level - 1) % PATTERNS.length]!(r, c),
  capsuleChance: 0.18,
  speed: 320,
});
