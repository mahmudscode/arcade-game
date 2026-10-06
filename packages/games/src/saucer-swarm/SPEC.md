# Saucer Swarm (`saucer-swarm`)

**Catalog #:** 1 (Space Invaders style) · **Archetype:** FS · **Size:** S · **Status:** dev

## 1. Pitch
Slide a laser cannon along the bottom, shoot a marching swarm of saucers before it lands, and hide behind crumbling shields.

## 2. Original identity
Round saucer pilots in coral / gold / cyan / purple on the Comet Crusher night-sky palette. Soft square-wave sound. Original shapes drawn with canvas primitives; no historic sprites.

## 3. Core loop
1. Swarm steps sideways; at an edge it drops one row and reverses.
2. Player moves and fires one shot at a time.
3. Saucers drop bombs from the lowest ship in a random column.
4. A bonus UFO crosses the top now and then.
5. Clear the swarm for the next wave (starts one row lower, up to a cap).

## 4. Controls
| Action | Keyboard | Touch |
|---|---|---|
| Move | Arrows / A D | virtual pad |
| Fire | Space / Z | A |
| Start / restart | Enter / Space | A |

## 5. Rules
- Logical resolution 800x570. 3 lives, extra life every 10000.
- Lose a life when hit by a bomb; game over at 0 lives or when the swarm reaches the cannon row.
- Swarm speed rises as ships are destroyed and with the wave number.

## 6. Entities
| Entity | Behavior | Points |
|---|---|---|
| Top-row saucer | marches | 30 |
| Middle rows | marches | 20 |
| Bottom rows | marches | 10 |
| Bonus UFO | crosses top, 50-300 | from `ctx.rng` |
| Shield | 4 blocks of cells, erodes when hit | - |

## 7. Scoring
Integer, only changed in `update`.

## 8. Determinism notes
All randomness (bomb column, UFO timing and value) uses `ctx.rng`. Timers use `dt`.

## 9. Assets
Canvas-drawn shapes. SFX: fire, explode, die, pickup (extra life), wave, start.

## 10. Edge cases
Pause is handled by the session. Restart re-inits with the stored hi-score. Player shot and bomb hitting the same frame: both resolve.

## 11. Acceptance criteria
- [x] Deterministic replay test
- [x] Invariant and JSON round-trip tests
