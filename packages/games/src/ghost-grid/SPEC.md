# Ghost Grid (`ghost-grid`)

**Catalog #:** 26 · **Archetype:** MZ · **Status:** dev

## Pitch
Eat every pellet in a fresh maze while four ghosts hunt you; power pellets turn the tables.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
◀ ▶ ▲ ▼ = Steer. Enter or Space restarts after game over, P pauses.

## Rules
Maze-chase core: new random maze every level, four ghosts with different targeting, power pellets (ghost chain 200/400/800/1600), fruit after 40 pellets.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON.

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`ghost-grid.test.ts`)
