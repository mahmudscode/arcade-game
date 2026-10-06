# Sky Ace 88 (`sky-ace-88`)

**Catalog #:** 8 · **Archetype:** SS · **Status:** dev

## Pitch
Dogfight waves of planes and gunships, grab weapon pickups and survive the scroll.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
◀ ▶ ▲ ▼ = Fly; Space = Fire (hold). Enter or Space restarts after game over, P pauses.

## Rules
Vertical scroller on the shared scroll-shooter core. Waves, chasers and 5-hp gunships; pickups upgrade the shot to double then triple. 3 lives, extra life every 20000.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON.

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`sky-ace-88.test.ts`)
