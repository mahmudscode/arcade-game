# Gold Raider (`gold-raider`)

**Catalog #:** 33 · **Archetype:** PF · **Status:** dev

## Pitch
Dig pits in brick floors to trap guards, collect all the gold and climb out.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Arrows run and climb, Z digs a pit ahead-left, X digs ahead-right, Up climbs out of a pit, Enter or Space restarts, P pauses. Touch: virtual pad + A / B.

## Rules
28x16 level of two-brick-thick floors joined by ladders (no jumping). A dug pit refills after 7 s; a guard inside it is lost (75) and a new one appears at the top, and you are lost too if it refills on you. Guards pathfind (breadth-first over walking, climbing and falling) and can cross a pit by falling in and climbing out. Each bar of gold is 250. Taking the last bar reveals a ladder from the top floor; reaching its top clears the level. 3 lives.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON. Movement uses the shared tile physics in `_shared/platformer.ts` (tested in `platformer.test.ts`).

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`gold-raider.test.ts`)
- [x] Rule tests: digging and refilling, gold and the escape ladder, trapping and killing guards, pathfinding up ladders, pit death and scramble-out, no jumping, level generation
- [x] Render smoke test (no throw, no non-finite coordinates)
