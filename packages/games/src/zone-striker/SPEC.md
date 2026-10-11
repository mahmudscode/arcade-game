# Zone Striker (`zone-striker`)

**Catalog #:** 7 · **Archetype:** SS · **Status:** dev

## Pitch
Shoot air raiders and bomb ground installations through a forward crosshair, then destroy the fortress.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Arrows fly, Space or Z shoots air targets, X drops a bomb on the crosshair ahead of the ship (a short cooldown), Enter or Space restarts, P pauses. Touch: virtual pad + A / B.

## Rules
Vertical scroller. Air enemies: rings (100), darts (150) and armour that takes three hits (300). Ground installations: domes (200), towers (300) and tanks (two bombs, 400). The gun cannot hurt ground targets and bombs cannot hurt air ones. After a fixed distance a fortress arrives and the normal spawning stops; 14 bomb hits destroy it (5000) and the next, faster stage begins. 3 lives.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON. Plain scroller; positions in screen space.

## Acceptance
- [x] Deterministic replay, invariant, JSON round-trip and "ends when idle" tests (`zone-striker.test.ts`)
- [x] Rule tests: movement limits, twin shots, air kinds, bomb timing and radius, separation of air and ground, cooldown, tanks, hits and invulnerability, spawning, fortress
- [x] Render smoke test (no throw, no non-finite coordinates)
