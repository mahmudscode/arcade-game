# Turbo Tunnel (`turbo-tunnel`)

**Catalog #:** 74 · **Archetype:** R3 · **Status:** dev

## Pitch
Race through a dark tunnel with tight curves and heavy traffic against the clock.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
◀ ▶ = Steer; ▲ Space = Accelerate; ▼ X = Brake. Enter or Space restarts after game over, P pauses.

## Rules
Pseudo-3D racer core with a time limit; reach each checkpoint to add seconds. Traffic collisions slow you down.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON.

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`turbo-tunnel.test.ts`)
