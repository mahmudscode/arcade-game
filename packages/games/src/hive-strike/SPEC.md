# Hive Strike (`hive-strike`)

**Catalog #:** 2 (Galaga style) · **Archetype:** FS · **Size:** M · **Status:** dev

## 1. Pitch
Blast a swarm that swoops into formation, dodge its dives, and beware the boss beam that can steal your ship. Win it back for a dual fighter.

## 2. Original identity
Winged beetles in coral / purple / gold / cyan on the Comet Crusher night-sky palette. Shapes drawn with canvas primitives; no historic sprites.

## 3. Core loop
1. Groups of beetles fly curved paths into a hovering, swaying formation.
2. Beetles peel off to dive and drop aimed bombs, then re-enter from the top.
3. A boss may dive to a hover point and fire a tractor beam; a ship caught in it is captured.
4. Shooting the boss that holds the captive ship gives a dual fighter (twice the firepower, one extra hit).
5. Every 4th wave (3, 7, ...) is a challenge stage: 32 beetles fly through without shooting. 100 points per hit, 10000 for a perfect run.

## 4. Controls
| Action | Keyboard | Touch |
|---|---|---|
| Move | Arrows / A D | virtual pad |
| Fire | Space / Z | A |
| Start / restart | Enter / Space | A |

## 5. Rules
- Logical resolution 800x570. 3 lives, extra life every 10000.
- Hit by a bomb or a ramming beetle: lose a life, or lose the dual fighter first.
- Capture costs a life; game over at 0 lives.
- Bosses take two hits.

## 6. Entities
| Entity | Behavior | Points (formation / diving) |
|---|---|---|
| Boss | two hits, tractor beam | 150 / 400 (+1000 for a rescue) |
| Wasp, hornet | dive and bomb | 80 / 160 |
| Drone | dive and bomb | 50 / 100 |

## 7. Scoring
Integer, only changed in `update`.

## 8. Determinism notes
All randomness (dive choice and timing, beam chance, bomb timing) uses `ctx.rng`. Motion uses `dt`.

## 9. Assets
Canvas-drawn shapes. SFX: fire, explode, die, pickup, wave, start.

## 10. Edge cases
Pause is handled by the session. Restart re-inits with the stored hi-score. Killing a captor while the player is dead applies the dual fighter on respawn. Capture on the last life ends the game.

## 11. Acceptance criteria
- [x] Deterministic replay test
- [x] Invariant and JSON round-trip tests
