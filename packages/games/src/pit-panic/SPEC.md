# Pit Panic (`pit-panic`)

**Catalog #:** 58 · **Archetype:** PF · **Status:** dev

## Pitch
Dig traps in the floor, then whack the monsters that fall in.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
◀ ▶ = Walk; ▲ ▼ = Climb ladders; Space = Dig / whack. Enter or Space restarts after game over, P pauses.

## Rules
Four floors linked by ladders and a 60 s oxygen clock. Dig a hole beside you; a monster that falls in is trapped for about 3 s: whack it to kill it.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON.

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`pit-panic.test.ts`)
