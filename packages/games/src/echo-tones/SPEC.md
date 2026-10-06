# Echo Tones (`echo-tones`)

**Catalog #:** 100 · **Archetype:** GP · **Status:** dev

## Pitch
Watch a growing pattern of coloured pads, then repeat it from memory.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Arrows / A D / W S, Space or Z = primary (A), X = secondary (B), Enter or Space restarts, P pauses. Touch: virtual pad + A / B.

## Rules
Four pads (Up/Right/Down/Left). A wrong or late (5 s) input costs a life and replays the same pattern. Completing a round adds one step and scores 100 x round.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON.

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`echo-tones.test.ts`)
