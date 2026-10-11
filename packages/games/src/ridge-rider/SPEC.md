# Ridge Rider (`ridge-rider`)

**Catalog #:** 76 (Hang-On style) · **Archetype:** R3 · **Status:** dev

## Pitch
Lean a superbike through long coastal bends, weave through traffic and beat the checkpoint clock.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
See the in-game controls panel. Enter restarts, P pauses. Touch: virtual pad + A / B.

## Rules
A pseudo-3D road with hills and curves from a seeded track. Hold the gas to build speed; curves push you outward in proportion to speed, so brake and lean into them. Traffic must be overtaken; hitting it costs speed. Each checkpoint (every 3000 units) adds 28 seconds; the run ends when time runs out. Built on the road-racer archetype with the `bike` option (narrow hitbox, sharper steering, harder braking).

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON.

## Acceptance
- [x] Deterministic replay, invariant, JSON round-trip and "ends when idle" tests (`ridge-rider.test.ts`)
- [x] Rule tests for the archetype's mechanics
- [x] Render smoke test (no throw, no non-finite coordinates)
