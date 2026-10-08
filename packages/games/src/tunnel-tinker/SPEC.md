# Tunnel Tinker (`tunnel-tinker`)

**Catalog #:** 28 (Dig Dug style) · **Archetype:** MZ · **Size:** M · **Status:** dev

## 1. Pitch
Tunnel through the dirt, inflate underground monsters with your pump until they pop, and drop rocks on the rest.

## 2. Original identity
Original name and shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## 3. Core loop
1. Dig tunnels by walking into dirt.
2. Fire the pump at a monster in front of you, then hold to inflate it until it pops.
3. Monsters sometimes turn to ghosts and drift straight through dirt toward you.
4. Undermine a rock so it falls and crushes whatever is below.
5. Clear every monster for the next round.

## 4. Controls
| Action | Keyboard | Touch |
|---|---|---|
| Dig / move | Arrows / WASD | virtual pad |
| Pump (hold to inflate) | Space / Z | A |
| Start / restart | Enter / Space | A |

## 5. Rules
- Logical resolution 800x570.
- 22x14 cell field, 3 lives, extra life every 10000.
- Moving breaks the pump connection.
- Deeper kills are worth more (200 to 800).
- A falling rock kills anything in its path, including you.

## 6. Entities
| Entity | Behavior / points |
|---|---|
| Monster | 200 x depth tier |
| Rock | 500 per monster crushed |

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
