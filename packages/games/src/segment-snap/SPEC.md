# Segment Snap (`segment-snap`)

**Catalog #:** 4 · **Archetype:** FS · **Status:** dev

## Pitch
Blast a centipede of segments snaking down through a mushroom field.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
◀ ▶ ▲ ▼ = Move; Space = Fire. Enter or Space restarts after game over, P pauses.

## Rules
Fixed-screen shooter: one shot at a time, segments split when shot and leave a mushroom, mushrooms take four hits.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON.

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`segment-snap.test.ts`)
