# Crate Shift (`crate-shift`)

**Catalog #:** 96 · **Archetype:** GP · **Status:** dev

## Pitch
Push every crate onto a goal in as few moves as you can.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
◀ ▶ ▲ ▼ = Move / push; B = Undo; Enter = Restart level. Enter or Space restarts after game over, P pauses.

## Rules
Five hand-made levels, each proven solvable by the test suite. Score is higher for fewer moves.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON.

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`crate-shift.test.ts`)
