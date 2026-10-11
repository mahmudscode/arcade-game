# Lift Agent (`lift-agent`)

**Catalog #:** 49 · **Archetype:** PF · **Status:** dev

## Pitch
Ride elevators down a guarded tower, take every document, and escape.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Left / Right walk, Up / Down ride an elevator you are standing on, Down duck, Up at a red door takes the document, X jumps, Space shoots, Enter or Space restarts, P pauses. Touch: virtual pad + A / B.

## Rules
Five floors with two elevator shafts whose cars you control while standing on them. Red doors hide documents (500 each); take all of them, then reach the exit on the ground floor before the mission clock runs out. Guards come out of doors, patrol (they will not step into open shafts), and shoot when lined up: high shots can be ducked, low ones cannot. Your shots defeat guards (150). 3 lives.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON. Elevator cars carry the hero explicitly; walking and jumping use `_shared/platformer.ts`.

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`lift-agent.test.ts`)
- [x] Rule tests: elevators (riding, limits, falling into shafts), documents, exit gating, shooting, ducking, guard spawning and edges, mission clock
- [x] Render smoke test (no throw, no non-finite coordinates)
