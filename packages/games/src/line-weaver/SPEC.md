# Line Weaver (`line-weaver`)

**Catalog #:** 38 (Qix style) · **Archetype:** GP · **Size:** S · **Status:** dev

## 1. Pitch
Draw lines into open space to wall off territory while a spinning line and wall-crawling sparks hunt you.

## 2. Original identity
Original name and shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## 3. Core loop
1. Walk along claimed edges; hold Fire and step into open space to draw a trail.
2. Close the trail back onto a wall to claim every region without the spinning line.
3. Sparks patrol the walls; the line kills you if it touches an unfinished trail.
4. Claim 75% of the field to clear the level.

## 4. Controls
| Action | Keyboard | Touch |
|---|---|---|
| Move | Arrows / WASD | virtual pad |
| Draw (hold) | Space / Z | A |
| Start / restart | Enter / Space | A |

## 5. Rules
- Logical resolution 800x570.
- 90x58 cell field, 3 lives.
- Moving onto your own trail loses a life.
- Sparks near you on a wall lose a life; two sparks from level 3.
- Level clears at 75% claimed with a 1000 x level bonus.

## 6. Entities
| Entity | Behavior / points |
|---|---|
| Claimed cell | 4 points |
| Spinning line | drifts and bounces, deadly to trails |
| Spark | crawls along walls toward you |

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
