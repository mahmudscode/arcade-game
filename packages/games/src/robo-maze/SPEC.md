# Robo Maze (`robo-maze`)

**Catalog #:** 21 (Berzerk style) · **Archetype:** MZ · **Size:** M · **Status:** dev

## 1. Pitch
Shoot your way through rooms of laser-spitting robots, but do not linger: a bouncing smiley will find you.

## 2. Original identity
Original name and shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## 3. Core loop
1. Each room is a random maze of walls with a doorway on every side.
2. Shoot robots in the direction you last moved; they shoot back when lined up.
3. Robots that touch a wall explode.
4. Linger too long and an unshootable pursuer appears.
5. Leave by any doorway for the next room.

## 4. Controls
| Action | Keyboard | Touch |
|---|---|---|
| Move | Arrows / WASD | virtual pad |
| Fire | Space / Z | A |
| Start / restart | Enter / Space | A |

## 5. Rules
- Logical resolution 800x570.
- 3 lives, extra life every 10000.
- Bullets and robot contact are fatal; walls only block you.
- 100 x robots bonus for clearing a room before leaving.

## 6. Entities
| Entity | Behavior / points |
|---|---|
| Robot | 50 |
| Pursuer | invulnerable, speeds up with level |

## 7. Scoring
Integer, only changed in `update`.

## 8. Determinism notes
All randomness uses `ctx.rng`; all timing uses `dt`. State is plain JSON.

## 9. Assets
Canvas-drawn shapes. SFX: fire, explode, die, pickup, wave, start.

## 10. Edge cases
Pause is handled by the session. Restart re-inits with the stored hi-score.

## 11. Acceptance criteria
- [x] Deterministic replay test
- [x] Invariant and JSON round-trip tests
