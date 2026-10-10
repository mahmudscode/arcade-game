# Jelly Pop (`jelly-pop`)

**Catalog #:** 90 · **Archetype:** FB · **Status:** dev

## Pitch
Stack falling jelly pairs and connect four or more of a colour to pop them; chains multiply the score.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Arrows / A D / W S, Space or Z = primary (A, rotate), X = secondary (B, rotate back), Down = soft drop, Enter or Space restarts, P pauses. Touch: virtual pad + A / B.

## Rules
6x12 well, 4 colours. Pairs rotate around a pivot with a one-cell wall kick. After landing, loose jellies fall one row per step, then every orthogonally connected group of 4+ pops; each chain step multiplies the score (1, 8, 16, 32, ...). Game over when the spawn column is blocked.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON. Shared key auto-repeat and rotation offsets live in `_shared/falling.ts`.

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`jelly-pop.test.ts`)
- [x] Rule tests: matches, gravity and chain scoring
