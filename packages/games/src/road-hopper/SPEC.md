# Road Hopper (`road-hopper`)

**Catalog #:** 98 · **Archetype:** GP · **Status:** dev

## Pitch
Hop across traffic and ride logs over the river to reach the five home slots.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Arrows / A D / W S, Space or Z = primary (A), X = secondary (B), Enter or Space restarts, P pauses. Touch: virtual pad + A / B.

## Rules
12-row field, 30 s per frog, 3 lives. Cars kill, river water kills, logs carry you. Filling all five slots advances the level (+1000).

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON.

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`road-hopper.test.ts`)
