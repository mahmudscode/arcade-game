# Bot Blitz (`bot-blitz`)

**Catalog #:** 17 · **Archetype:** AR · **Status:** dev

## Pitch
Run and gun through an arena swarming with chasing robots.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
◀ ▶ ▲ ▼ = Move (8-way); Space = Fire in your facing direction. Enter or Space restarts after game over, P pauses.

## Rules
Arena shooter: you fire the way you last moved. Grunts die in one hit; hulks (wave 3+) are indestructible, so keep moving.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON.

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`bot-blitz.test.ts`)
