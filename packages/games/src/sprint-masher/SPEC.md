# Sprint Masher (`sprint-masher`)

**Catalog #:** 86 · **Archetype:** PB · **Status:** dev

## Pitch
Mash left and right to sprint, then clear the hurdles in a qualifying race.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
◀ ▶ = Alternate to run; Space = Jump (hurdles). Enter or Space restarts after game over, P pauses.

## Rules
Alternating rounds of 100 m dash and hurdles against three AI runners. Finish top three inside the qualifying time or lose a life.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON.

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`sprint-masher.test.ts`)
