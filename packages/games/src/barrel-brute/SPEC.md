# Barrel Brute (`barrel-brute`)

**Catalog #:** 40 · **Archetype:** PF · **Status:** dev

## Pitch
Climb crooked girders to the top while a brute rolls barrels at you.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Left / Right run, Up / Down climb ladders, Space or Z jumps, Enter or Space restarts, P pauses. Touch: virtual pad + A / B.

## Rules
Five girders, each with a gap at alternating ends, joined by ladders. Barrels roll downhill along each girder and drop wherever it ends or a ladder crosses it. Touching one costs a life; hopping it scores 100. A hammer lets you smash barrels (300) for 8 s but you cannot jump with it. The bonus counts down from 5000; reaching the goal at the top banks it, running it out costs a life. Falling through the bottom gap costs a life. 3 lives.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON. Movement uses the shared tile physics in `_shared/platformer.ts` (tested in `platformer.test.ts`).

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`barrel-brute.test.ts`)
- [x] Rule tests: walking and jumping, barrel rolling and dropping, hits and hops, hammer, ladders and the goal, bonus timer, bottom gap, level generation
- [x] Render smoke test (no throw, no non-finite coordinates)
