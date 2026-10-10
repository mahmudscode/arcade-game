# Garden Gates (`garden-gates`)

**Catalog #:** 30 · **Archetype:** MZ · **Status:** dev

## Pitch
Eat every dot in a hedge maze, using swinging gates to cut off the bugs that chase you.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Arrows / WASD move, moving into a closed gate pushes it open, Enter or Space restarts, P pauses. Touch: virtual pad + A / B.

## Rules
Generated 21x19 maze with 9+ gates placed in straight corridors. A closed gate is a wall; pushing it opens it for about 2.6 s, after which it swings shut again unless something is standing in it. Bugs chase along shortest paths (never through closed gates) with a little randomness. Hearts make bugs edible for 6 s. Bonus vegetable after 40 dots. 3 lives.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON. Tile movement uses `_shared/walker.ts`.

## Acceptance
- [x] Deterministic replay, invariant, JSON round-trip and "ends when idle" tests (`garden-gates.test.ts`)
- [x] Rule tests: gate opening and closing, occupied gates, dots and hearts, bug pathing, level clear
- [x] Render smoke test (no throw, no non-finite coordinates)
