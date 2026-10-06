# Gem Cascade (`gem-cascade`)

**Catalog #:** 91 · **Archetype:** FB · **Status:** dev

## Pitch
Drop three-gem columns and line up 3+ of a colour in any direction to clear them; chains multiply.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Arrows / A D / W S, Space or Z = primary (A), X = secondary (B), Enter or Space restarts, P pauses. Touch: virtual pad + A / B.

## Rules
6x13 well, 5 gem colours. Up/A cycles the column, B cycles back. Matches work horizontally, vertically and diagonally; each chain step multiplies the score. Game over when the column cannot spawn.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON.

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`gem-cascade.test.ts`)
