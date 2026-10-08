# Lance Flyers (`lance-flyers`)

**Catalog #:** 48 (Joust style) · **Archetype:** PF · **Size:** M · **Status:** dev

## 1. Pitch
Flap a winged mount above lance-wielding rivals to win the joust, then grab their eggs before they hatch tougher.

## 2. Original identity
Original name and shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## 3. Core loop
1. Tap flap to climb; steer left and right, wrapping around the screen.
2. Meet a rival at a higher altitude to defeat it; lower and you lose a life.
3. Defeated rivals leave eggs; collect them before they hatch stronger riders.
4. Clear all riders and eggs for the next wave.

## 4. Controls
| Action | Keyboard | Touch |
|---|---|---|
| Steer | Left / Right | virtual pad |
| Flap | Space / Z / Up | A |
| Start / restart | Enter / Space | A |

## 5. Rules
- Logical resolution 800x570.
- 3 lives, extra life every 20000.
- Equal-height hits bounce both riders.
- Eggs hatch after 7 s into a higher tier.

## 6. Entities
| Entity | Behavior / points |
|---|---|
| Bounder | 500 |
| Hunter | 750 |
| Shadow | 1000 |
| Egg | 250, 500, 750, 1000 in a chain |

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
