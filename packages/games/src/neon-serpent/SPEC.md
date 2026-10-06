# Neon Serpent (`neon-serpent`)

**Catalog #:** 93 · **Archetype:** GP · **Status:** dev

## Pitch
Steer a growing serpent to eat food without hitting a wall or yourself.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Arrows / A D / W S, Space or Z = primary (A), X = secondary (B), Enter or Space restarts, P pauses. Touch: virtual pad + A / B.

## Rules
40x26 grid, 1 life. Eating grows the serpent and scores 10 x level; speed increases every 8 segments.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON.

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`neon-serpent.test.ts`)
