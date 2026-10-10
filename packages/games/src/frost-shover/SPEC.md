# Frost Shover (`frost-shover`)

**Catalog #:** 29 · **Archetype:** MZ · **Status:** dev

## Pitch
Slide ice blocks to crush the creatures that hunt you in a walled ice field.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Arrows / WASD move, moving into a block pushes it, Enter or Space restarts, P pauses. Touch: virtual pad + A / B.

## Rules
15x13 field, about half filled with ice blocks; three of them are gold. A pushed block slides until it hits something and crushes any creature on the way (400, doubling for each extra one). A block that cannot slide crumbles (ice only, 30 points). Creatures wander and chase, and chew through ice if boxed in. Lining the three gold blocks up in a row pays 5000 and stuns every creature, and a stunned creature can be defeated by touch (100). Clear every creature to advance. 3 lives.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON. Tile movement uses `_shared/walker.ts`.

## Acceptance
- [x] Deterministic replay, invariant, JSON round-trip and "ends when idle" tests (`frost-shover.test.ts`)
- [x] Rule tests: sliding, crushing, crumbling, gold alignment, chewing, level progression
- [x] Render smoke test (no throw, no non-finite coordinates)
