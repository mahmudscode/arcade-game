# Jungle Dash (`jungle-dash`)

**Catalog #:** 46 · **Archetype:** SC · **Status:** dev

## Pitch
Sprint through the jungle, leaping logs, pits and scorpions to grab gems.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Space ▲ = Jump. Enter or Space restarts after game over, P pauses.

## Rules
Auto-scrolling runner. Jump to clear hazards; gems score 250. Speed rises with distance.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON.

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`jungle-dash.test.ts`)
