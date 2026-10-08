# Rally Maze (`rally-maze`)

**Catalog #:** 34 (Rally-X style) · **Archetype:** MZ · **Size:** M · **Status:** dev

## 1. Pitch
Race through a maze collecting flags while rival cars hunt you; lay smoke to stall them and watch the fuel gauge.

## 2. Original identity
Original name and shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## 3. Core loop
1. Steer the car through a generated maze; it keeps going until it hits a wall.
2. Collect every flag; each one refuels you and gives a smoke charge.
3. Rival cars take the shortest path to you.
4. Drop smoke to stall any rival that drives into it.
5. Collect all flags for the next round.

## 4. Controls
| Action | Keyboard | Touch |
|---|---|---|
| Steer | Arrows / WASD | virtual pad |
| Smoke | X / B | B |
| Start / restart | Enter / Space | A |

## 5. Rules
- Logical resolution 800x570.
- 3 lives, extra life every 10000.
- Fuel drains slowly; at zero the car crawls at half speed.
- Flag chain scores 100 up to 500 each; round bonus 1000.

## 6. Entities
| Entity | Behavior / points |
|---|---|
| Flag | 100-500 chain, +fuel, +smoke |
| Rival car | kills on contact unless stalled |

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
