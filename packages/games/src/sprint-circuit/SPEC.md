# Sprint Circuit (`sprint-circuit`)

**Catalog #:** 78 (Super Sprint style) · **Archetype:** RT · **Status:** dev

## Pitch
A single-screen circuit with three rivals: slide through the bends, dodge oil, grab wrenches and finish in the top two.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
See the in-game controls panel. Enter restarts, P pauses. Touch: virtual pad + A / B.

## Rules
A closed circuit on one screen, four cars, four laps. The car slides: it keeps momentum sideways, so brake into bends. Leaving the track slows you; oil slicks make cars spin out; wrenches raise your top speed (up to five). Finish in the top two to qualify for a harder race, otherwise lose one of 3 lives. After the first rival finishes there is a 14 s grace period.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON.

## Acceptance
- [x] Deterministic replay, invariant, JSON round-trip and "ends when idle" tests (`sprint-circuit.test.ts`)
- [x] Rule tests for the archetype's mechanics
- [x] Render smoke test (no throw, no non-finite coordinates)
