# Neon Trails (`neon-trails`)

**Catalog #:** 39 · **Archetype:** AR · **Status:** dev

## Pitch
Race a light-trail cycle and trap the rival into crashing into a wall or a trail.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Arrows / A D / W S, Space or Z = primary (A), X = secondary (B), Enter or Space restarts, P pauses. Touch: virtual pad + A / B.

## Rules
40x26 arena, 3 lives. Crashing costs a life; the rival crashing scores 100 x level and raises the level (faster, smarter rival). Survival also scores 1 per step.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON.

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`neon-trails.test.ts`)
