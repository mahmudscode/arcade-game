# Deep Delver (`deep-delver`)

**Catalog #:** 54 · **Archetype:** SC · **Status:** dev

## Pitch
Descend a cave on ropes before the air runs out.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Left / Right walk, Up / Down climb ropes, X jumps, Space or Z fires a flare, Enter or Space restarts, P pauses. Touch: virtual pad + A / B.

## Rules
A cave of tiers joined by hanging ropes; beside each rope is an open drop. Any fall of more than 3.3 tiles from its highest point is fatal (jumping and short drops are fine). Air drains steadily; capsules refill it. Bats patrol, spiders ride the ropes, and after 70 s a ghost drifts through the walls toward you: a flare scares it away for 6 s. Treasure scores 500. Reach the exit at the bottom for a bonus and a deeper cave. 3 lives.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON. Movement uses the shared tile physics in `_shared/platformer.ts`.

## Acceptance
- [x] Deterministic replay, invariant, JSON round-trip and "ends when idle" tests (`deep-delver.test.ts`)
- [x] Rule tests: fall damage, ropes, air, treasure and flares, bats and spiders, the ghost, the exit
- [x] Render smoke test (no throw, no non-finite coordinates)
