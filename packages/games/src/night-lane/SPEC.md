# Night Lane (`night-lane`)

**Catalog #:** 77 (Night Driver style) · **Archetype:** R3 · **Size:** M · **Status:** dev

## 1. Pitch
Drive a pitch-black road lit only by reflector posts and oncoming headlights, racing the checkpoint clock.

## 2. Original identity
Original name and shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## 3. Core loop
1. Steer to follow reflector posts through tight curves.
2. Weave around the glare of oncoming traffic.
3. Reach each checkpoint to add time to the clock.
4. Run out of time or crash too often and the run ends.

## 4. Controls
| Action | Keyboard | Touch |
|---|---|---|
| Steer | Left / Right | virtual pad |
| Accelerate | Up / Space | A |
| Brake | Down / X | B |
| Start / restart | Enter / Space | A |

## 5. Rules
- Logical resolution 800x570.
- Built on the shared road-racer archetype with the dark tunnel look.
- Checkpoint every 3000 units adds 22 seconds.
- Driving off the road slows the car heavily.

## 6. Entities
| Entity | Behavior / points |
|---|---|
| Traffic car | obstacle; collisions cost speed and time |
| Checkpoint | bonus time and points |

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
