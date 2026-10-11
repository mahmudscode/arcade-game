# Pipe Bumper (`pipe-bumper`)

**Catalog #:** 42 · **Archetype:** PF · **Status:** dev

## Pitch
Bump platforms from below to flip enemies, then kick them away.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Left / Right run (the sides wrap), Space / Up / Z jump, Enter or Space restarts, P pauses. Touch: virtual pad + A / B.

## Rules
Five tiers joined by gaps you can jump through. Hitting the underside of a platform flips enemies standing on it for 6 s (crabs need two bumps); hitting a flipped enemy wakes it up angry. Touch a flipped enemy to kick it away (800, doubling in a row); touching one on its feet costs a life. The POW block flips everything on a floor and works three times. Enemies leave by the bottom corners and re-enter at the top. A fireball sweeps the floor you are standing on every few seconds, so keep moving or jump. Beat every enemy to clear the level. 3 lives.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON. Movement uses the shared tile physics in `_shared/platformer.ts` (tested in `platformer.test.ts`).

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`pipe-bumper.test.ts`)
- [x] Rule tests: bumping, flipping, kicking and combos, enemy recovery, crabs, POW, screen wrap, re-entry, fireballs, level progression
- [x] Render smoke test (no throw, no non-finite coordinates)
