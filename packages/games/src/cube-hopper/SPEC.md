# Cube Hopper (`cube-hopper`)

**Catalog #:** 44 · **Archetype:** GP · **Status:** dev

## Pitch
Hop diagonally across a pyramid to colour every cube while foes bounce down.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
◀ ▶ ▲ ▼ = Hop on the four diagonals. Enter or Space restarts after game over, P pauses.

## Rules
Arrows map to diagonals: Up = up-right, Right = down-right, Down = down-left, Left = up-left. Falling off the pyramid or touching a foe costs a life.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON.

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`cube-hopper.test.ts`)
