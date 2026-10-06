# Cavern Raid (`cavern-raid`)

**Catalog #:** 6 · **Archetype:** SS · **Status:** dev

## Pitch
Fly over scrolling terrain, shoot turrets and fuel tanks, and never run dry or crash.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
◀ ▶ ▲ ▼ = Fly; Space = Fire (hold). Enter or Space restarts after game over, P pauses.

## Rules
Horizontal scroller with terrain and a fuel gauge: shooting fuel tanks refills it, touching the ground or running dry costs a life.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON.

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`cavern-raid.test.ts`)
