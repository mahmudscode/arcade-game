# Paint Patrol (`paint-patrol`)

**Catalog #:** 37 · **Archetype:** MZ · **Status:** dev

## Pitch
Paint every line of the grid to fill the boxes while patrolling enemies roam.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
◀ ▶ ▲ ▼ = Move along lines; Space = Jump (3 per level). Enter or Space restarts after game over, P pauses.

## Rules
Walk the grid lines to paint them; completing a box scores 100. A jump gives 1.3 s of safety. Clear all 48 boxes to advance.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON.

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`paint-patrol.test.ts`)
