# Sky Circuit (`sky-circuit`)

**Catalog #:** 16 · **Archetype:** AR · **Status:** dev

## Pitch
Loop through the sky in a dogfight, then take down the stage boss.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
◀ ▶ = Turn; Space = Fire (hold). Enter or Space restarts after game over, P pauses.

## Rules
Your plane always flies forward; planes turn toward you at a limited rate. After 12 kills a boss with extra hit points arrives.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON.

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`sky-circuit.test.ts`)
