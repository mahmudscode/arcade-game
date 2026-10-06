# Beam Lancer (`beam-lancer`)

**Catalog #:** 14 · **Archetype:** SS · **Status:** dev

## Pitch
Tap to shoot, hold to charge a piercing beam.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
◀ ▶ ▲ ▼ = Fly; Space = Tap = shot, hold = charge beam. Enter or Space restarts after game over, P pauses.

## Rules
Horizontal scroller with a charge beam (hold A about 0.9 s, release) that pierces enemies for 6 damage.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON.

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`beam-lancer.test.ts`)
