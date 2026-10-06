# Bomb Catcher (`bomb-catcher`)

**Catalog #:** 97 · **Archetype:** PB · **Status:** dev

## Pitch
Slide a stack of buckets to catch bombs dropped by a restless bomber.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Arrows / A D / W S, Space or Z = primary (A), X = secondary (B), Enter or Space restarts, P pauses. Touch: virtual pad + A / B.

## Rules
3 buckets = 3 lives. A bomb that hits the floor blows up all bombs on screen and costs a bucket. Rounds drop more and faster bombs; each catch scores the round number.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON.

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`bomb-catcher.test.ts`)
