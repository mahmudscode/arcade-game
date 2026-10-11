# Crystal Quarry (`crystal-quarry`)

**Catalog #:** 95 · **Archetype:** GP · **Status:** dev

## Pitch
Dig through a cave, collect crystals and escape before time runs out, without being crushed.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Arrows move, dig and push (move into dirt to dig, sideways into a boulder to push it), Enter or Space restarts, P pauses. Touch: virtual pad + A / B.

## Rules
32x18 cave advancing in 0.1 s ticks. Boulders and crystals fall into empty space and roll off the shoulders of other rocks; only a rock that is already falling crushes. Fireflies hug the walls (left-hand rule), kill on contact, and when crushed blow up the surrounding 3x3 into crystals. Collect the quota (10 + 2 per level) to open the exit, then reach it; leftover seconds pay a bonus. Time limit 150 s per cave. 3 lives.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON.

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`crystal-quarry.test.ts`)
- [x] Rule tests: digging, gem collection, falling and rolling rocks, crush rules, pushing, exit and quota, fireflies, explosions, timer
- [x] Render smoke test (no throw, no non-finite coordinates)
