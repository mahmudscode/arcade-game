# Spring Sneak (`spring-sneak`)

**Catalog #:** 35 · **Archetype:** PF · **Status:** dev

## Pitch
Bounce between floors on trampolines, recover loot and blast the chasing cats with power doors.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Left / Right walk, Space or Z opens a power door next to you, Enter or Space restarts, P pauses. Touch: virtual pad + A / B.

## Rules
Five floors with three trampoline shafts. Walk into a shaft and you fall to the trampoline at the bottom and are bounced about four tiles up; steer in mid-air to land on the floor above. Each trampoline snaps after 6 bounces. There is no jump button. Collect every piece of loot (200-500 each) to clear the level. Cats patrol and head for you on your floor; touching one costs a life. A flashing power door blasts every cat on its floor within 9 tiles (200, doubling), once. 3 lives.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON. Movement uses the shared tile physics in `_shared/platformer.ts` (tested in `platformer.test.ts`).

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`spring-sneak.test.ts`)
- [x] Rule tests: trampolines and bouncing, steering, snapping, loot, power doors, cats, level generation
- [x] Render smoke test (no throw, no non-finite coordinates)
