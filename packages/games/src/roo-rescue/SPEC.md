# Roo Rescue (`roo-rescue`)

**Catalog #:** 55 · **Archetype:** PF · **Status:** dev

## Pitch
Climb four floors to rescue your joey, punching apples and monkeys.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Left / Right run, Up / Down climb ladders, X or Up (away from a ladder) jumps, Space or Z punches, Enter or Space restarts, P pauses. Touch: virtual pad + A / B.

## Rules
Four floors joined by two ladders per gap. Monkeys chase you over floors and ladders (shortest paths) and throw apples along your floor. A punch knocks away an apple (200) or sends a monkey flying (800; it returns at the top after 8 s). Jump apples or punch them; touching one costs a life. Reach the joey at the top before the bonus clock runs out. 3 lives.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON. Movement uses the shared tile physics in `_shared/platformer.ts` (tested in `platformer.test.ts`).

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`roo-rescue.test.ts`)
- [x] Rule tests: jump/punch/climb, punching apples and monkeys, apple hits and hops, monkey chase up ladders, rescue and bonus clock, level generation
- [x] Render smoke test (no throw, no non-finite coordinates)
