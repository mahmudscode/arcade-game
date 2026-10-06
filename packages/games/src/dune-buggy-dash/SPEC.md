# Dune Buggy Dash (`dune-buggy-dash`)

**Catalog #:** 75 · **Archetype:** R3 · **Status:** dev

## Pitch
Drive a sunny desert road with long sweeping curves before time runs out.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
◀ ▶ = Steer; ▲ Space = Accelerate; ▼ X = Brake. Enter or Space restarts after game over, P pauses.

## Rules
Same pseudo-3D racer core with gentler curves, lighter traffic and longer checkpoint bonuses.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON.

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`dune-buggy-dash.test.ts`)
