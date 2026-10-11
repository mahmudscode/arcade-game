# Tilt Track (`tilt-track`)

**Catalog #:** 99 · **Archetype:** GP · **Status:** dev

## Pitch
Steer a marble down winding isometric slopes against the clock.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Arrows push the marble along the matching screen directions, Enter or Space restarts, P pauses. Touch: virtual pad + A / B.

## Rules
A generated downhill track 3 tiles wide with flat, gentle and steep sections. Real slope physics: gravity along the surface gradient, your push, drag, and a top speed. Leave the track and you fall, return to the last checkpoint (every 20 cells) and lose 3 s. Steel marbles roll in ahead and shove you; one that falls off near you pays 500. Reach the finish before time runs out (leftover seconds x100); the next track is longer and steeper. Time out ends the run.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON.

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`tilt-track.test.ts`)
- [x] Rule tests: slope physics, steering directions, falling and checkpoints, progress scoring, finish and next race, steel marbles, track generation, surface continuity
- [x] Render smoke test (no throw, no non-finite coordinates)
