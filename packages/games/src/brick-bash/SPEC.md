# Brick Bash (`brick-bash`)

**Catalog #:** 84 · **Archetype:** PB · **Status:** dev

## Pitch
Bounce a ball off a paddle to smash every brick in the wall.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Arrows / A D / W S, Space or Z = primary (A), X = secondary (B), Enter or Space restarts, P pauses. Touch: virtual pad + A / B.

## Rules
Shared brick-breaker core, plain wall, 3 lives, ball auto-launches after 1.5 s or on A. Ball speed rises each level. Row value is higher at the top.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON.

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`brick-bash.test.ts`)
