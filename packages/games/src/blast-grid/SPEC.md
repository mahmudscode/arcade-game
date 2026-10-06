# Blast Grid (`blast-grid`)

**Catalog #:** 32 · **Archetype:** MZ · **Status:** dev

## Pitch
Plant bombs to blast through blocks and take out every roaming creature.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
◀ ▶ ▲ ▼ = Move; Space = Place bomb. Enter or Space restarts after game over, P pauses.

## Rules
Grid maze with indestructible pillars and soft blocks. Bombs explode in a cross after 2.2 s and chain. Blocks drop range / extra-bomb power-ups.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON.

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`blast-grid.test.ts`)
