# Web Warden (`web-warden`)

**Catalog #:** 18 (Tempest style) · **Archetype:** FS · **Size:** M · **Status:** dev

## 1. Pitch
Race a claw around the rim of a glowing web and blast climbers racing up the lanes before they reach you.

## 2. Original identity
Original name and shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## 3. Core loop
1. Enemies crawl up the lanes from the centre of the web.
2. Move the claw between lanes and fire down your lane.
3. Flippers hop lanes while climbing and chase the claw along the rim.
4. Tankers split into two flippers; spitters fire down their lane.
5. Use the zapper once per wave to wipe the web.

## 4. Controls
| Action | Keyboard | Touch |
|---|---|---|
| Move lane | Left / Right | virtual pad |
| Fire | Space / Z | A |
| Zapper | X / B | B |
| Start / restart | Enter / Space | A |

## 5. Rules
- Logical resolution 800x570.
- 16 lanes around a circular web. 3 lives, extra life every 10000.
- A rim enemy in your lane or a bolt reaching your lane kills the claw.
- One zapper charge per wave.

## 6. Entities
| Entity | Behavior / points |
|---|---|
| Flipper | 150 (+50 on the rim) |
| Tanker | 100, splits |
| Spitter | 250, shoots down its lane |

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
