# Ember Wing (`ember-wing`)

**Catalog #:** 12 (Phoenix style) · **Archetype:** FS · **Size:** M · **Status:** dev

## 1. Pitch
Shoot swooping firebirds from a fixed cannon, raise a brief shield, then crack the mothership and strike the alien at its core.

## 2. Original identity
Original name and shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## 3. Core loop
1. Bird waves hover in formation and swoop down in sine paths, dropping bombs.
2. Hold the shield to survive a bomb; it needs a few seconds to recharge.
3. Every third wave is a mothership: shoot through its hull while a sliding armour band blocks the way.
4. Hit the alien under the hull to destroy the ship.

## 4. Controls
| Action | Keyboard | Touch |
|---|---|---|
| Move | Arrows / A D | virtual pad |
| Fire | Space / Z | A |
| Shield | X / B | B |
| Start / restart | Enter / Space | A |

## 5. Rules
- Logical resolution 800x570.
- 3 lives, extra life every 10000.
- Shield lasts 1.2 s with a 4 s cooldown; while it is up bombs and rams do nothing.
- Waves cycle small birds, big birds, mothership.

## 6. Entities
| Entity | Behavior / points |
|---|---|
| Small bird | 50 (100 while swooping) |
| Big bird | 80 (160 while swooping) |
| Hull block | 30 |
| Alien core | 1000 + 100 per wave |

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
