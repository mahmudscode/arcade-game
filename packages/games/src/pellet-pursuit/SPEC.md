# Pellet Pursuit (`pellet-pursuit`)

**Catalog #:** 27 · **Archetype:** MZ · **Status:** dev

## Pitch
A wilder maze chase: ghosts wander unpredictably and the bonus fruit roams.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
◀ ▶ ▲ ▼ = Steer. Enter or Space restarts after game over, P pauses.

## Rules
Same maze-chase core with higher ghost randomness and a moving bonus fruit.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON.

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`pellet-pursuit.test.ts`)
