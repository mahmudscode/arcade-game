# Lunar Rover (`lunar-rover`)

**Catalog #:** 22 (Moon Patrol style) · **Archetype:** SC · **Size:** M · **Status:** dev

## 1. Pitch
Drive a six-wheeled rover across a cratered moon, hopping holes, blasting boulders and shooting the alien bombers overhead.

## 2. Original identity
Original name and shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## 3. Core loop
1. The moon scrolls past; jump over craters and rocks.
2. Fire forward at boulders and straight up at alien ships.
3. Alien bombs leave new craters in the road.
4. Each checkpoint adds a bonus and every five make the road faster.

## 4. Controls
| Action | Keyboard | Touch |
|---|---|---|
| Speed up / slow | Left / Right | virtual pad |
| Jump | Space / Z / Up | A |
| Fire (forward + up) | X / B | B |
| Start / restart | Enter / Space | A |

## 5. Rules
- Logical resolution 800x570.
- 3 lives, extra life every 10000.
- Falling into a crater or hitting a rock or bomb costs a life; you restart with brief invulnerability.
- Distance scores 1 point per 10 px.

## 6. Entities
| Entity | Behavior / points |
|---|---|
| Alien ship | 100 |
| Boulder | 50 when shot |
| Crater | jump it |
| Checkpoint | 500 |

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
