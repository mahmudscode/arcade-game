# Bounce Buggy (`bounce-buggy`)

**Catalog #:** 82 (Bump 'n' Jump style) · **Archetype:** RT · **Status:** dev

## Pitch
Bounce down the road: leap the water, land on rivals to squash them and shoulder them off the edge.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
See the in-game controls panel. Enter restarts, P pauses. Touch: virtual pad + A / B.

## Rules
The buggy bounces constantly down a winding road. Press Space/Z as you land for a big jump. Water gaps must be crossed in the air. Land on a rival to squash it, or shoulder it off the road edge for points; rivals shoving you off the edge wreck you. 3 lives; the road narrows each zone.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON.

## Acceptance
- [x] Deterministic replay, invariant, JSON round-trip and "ends when idle" tests (`bounce-buggy.test.ts`)
- [x] Rule tests for the archetype's mechanics
- [x] Render smoke test (no throw, no non-finite coordinates)
