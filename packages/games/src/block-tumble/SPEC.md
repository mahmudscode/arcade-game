# Block Tumble (`block-tumble`)

**Catalog #:** 88 · **Archetype:** FB · **Status:** dev

## Pitch
Rotate and place falling blocks to clear full lines.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Arrows / A D / W S, Space or Z = primary (A), X = secondary (B), Enter or Space restarts, P pauses. Touch: virtual pad + A / B.

## Rules
10x20 well, 7-bag randomizer from ctx.rng. Left/Right move, Up rotates, B rotates back, Down soft-drops, A hard-drops. 1/2/3/4 lines = 100/300/500/800 x level. Level up every 10 lines. Game over when a piece cannot spawn.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON.

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`block-tumble.test.ts`)
