# Ring Runner (`ring-runner`)

**Catalog #:** 10 (Gyruss style) · **Archetype:** FS · **Size:** M · **Status:** dev

## 1. Pitch
Circle your ship around the rim of the screen and fire inward at beetles that spiral out of the centre.

## 2. Original identity
Winged beetles in coral / gold / purple / cyan on the Comet Crusher night-sky palette, with a radial star warp. Shapes drawn with canvas primitives; no historic sprites.

## 3. Core loop
1. Groups of six beetles spiral outward from the centre and settle into small orbits.
2. Settled beetles fire aimed bullets at the ship.
3. After a while each one rushes the ship in a straight line; if it leaves the arena it re-enters from the centre.
4. Shoot the pod carrier (white ring) for twin shot, 12 seconds.
5. Clear all 24 beetles for the next wave.

## 4. Controls
| Action | Keyboard | Touch |
|---|---|---|
| Orbit | Left / Right, A D | virtual pad |
| Fire | Space / Z | A |
| Start / restart | Enter / Space | A |

## 5. Rules
- Logical resolution 800x570. 3 lives, extra life every 10000.
- A bullet or a rushing beetle kills the ship; brief invulnerability after respawn.
- Bullet speed, fire rate and rush timing scale with the wave (capped at 30).

## 6. Entities
| Entity | Points |
|---|---|
| Group 1 beetle | 100 |
| Group 3 beetle | 150 |
| Group 4 beetle | 200 |
| Pod carrier | 500 + twin shot |

## 7. Scoring
Integer, only changed in `update`.

## 8. Determinism notes
All randomness (spin direction, start angles, fire timing, hold time, star respawn) uses `ctx.rng`. Motion uses `dt`.

## 9. Assets
Canvas-drawn shapes. SFX: fire, explode, die, pickup, wave, start.

## 10. Edge cases
Pause is handled by the session. Restart re-inits with the stored hi-score. Angle wraps to [0, 2pi).

## 11. Acceptance criteria
- [x] Deterministic replay test
- [x] Invariant and JSON round-trip tests
