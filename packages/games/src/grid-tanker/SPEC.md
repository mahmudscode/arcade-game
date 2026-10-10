# Grid Tanker (`grid-tanker`)

**Catalog #:** 23 · **Archetype:** AR · **Status:** dev

## Pitch
Command a wireframe tank on a neon plain: track enemies on the radar, hide behind blocks and out-aim them.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Left / Right turn, Up / Down drive and reverse, Space or Z fires (one shell in flight), Enter or Space restarts, P pauses. Touch: virtual pad + A / B.

## Rules
First-person wireframe view with a 3D projection and near-plane clipping. A 1800x1800 arena holds 14 blocks and pyramids that stop movement and shells. Tanks close in, turn slowly and fire slow shells you can dodge; missiles (from wave 3) charge at speed; a bonus saucer crosses now and then. Clearing the ground threats starts the next wave (up to 3 tanks). 3 lives, extra life every 15,000.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON.

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`grid-tanker.test.ts`)
- [x] Rule tests: kills score 1000 / 2000 / 5000, enemy shells cost a life, blocks shield, one shell at a time, wave progression
- [x] Render smoke test (no throw, no non-finite coordinates)
