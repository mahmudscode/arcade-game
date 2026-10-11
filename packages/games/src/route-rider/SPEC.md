# Route Rider (`route-rider`)

**Catalog #:** 79 · **Archetype:** SC · **Status:** dev

## Pitch
Deliver papers down a street full of hazards.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Left / Right steer, Up / Down go faster or slower, Space or Z throws a paper to the left, X to the right, Enter or Space restarts, P pauses. Touch: virtual pad + A / B.

## Rules
The rider rolls down a street with houses on both sides; about half are subscribers. A paper in a subscriber's mailbox scores 250, on the porch 100; smashing a non-subscriber's window scores 400, but a window through a subscriber's house cancels the subscription. Cars, parked cars, dogs, kids and potholes wreck you (a life). Bundles restock papers. At the end, deliveries pay 100 each, plus 2000 if every subscriber got one, plus 20 per paper left; the next day is longer. 3 lives.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON. A top-down view where z is the distance down the street.

## Acceptance
- [x] Deterministic replay, invariant, JSON round-trip and "ends when idle" tests (`route-rider.test.ts`)
- [x] Rule tests: steering and speed, throwing, mailboxes, windows and cancellation, porches, wrecks, bundles, the end-of-street bonus
- [x] Render smoke test (no throw, no non-finite coordinates)
