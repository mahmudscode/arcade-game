# Pixel Pong Pro (`pixel-pong-pro`)

**Catalog #:** 83 · **Archetype:** PB · **Status:** dev

## Pitch
Rally a ball past a computer paddle that gets quicker each level.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Arrows / A D / W S, Space or Z = primary (A), X = secondary (B), Enter or Space restarts, P pauses. Touch: virtual pad + A / B.

## Rules
800x570, Up/Down moves your paddle. 3 lives (the AI scoring costs one). Each point you win scores 100 x level; every 5 points raises the level and the AI's speed. The ball speeds up on each hit.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON.

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`pixel-pong-pro.test.ts`)
