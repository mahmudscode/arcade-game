# Canopy Climb (`canopy-climb`)

**Catalog #:** 57 · **Archetype:** PF · **Status:** dev

## Pitch
Scale an isometric cliff path toward the ape, hopping the coconuts he rolls at you.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Arrows move along the isometric screen directions, Space or Z hops, Enter or Space restarts, P pauses. Touch: virtual pad + A / B.

## Rules
A winding 3-wide path that climbs to the ape (it shares track generation with Tilt Track in `_shared/iso-track.ts`). The ape rolls coconuts down the path in one of three lanes; a hop clears one, touching one costs a life. Monkeys chase along the path. Stepping off the track is a fall and a lost life. Reaching the top banks the bonus (counting down from 3000) and starts a longer climb. 3 lives.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON. Movement is free-form on the isometric surface (`_shared/iso-track.ts`), not tile physics.

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`canopy-climb.test.ts`)
- [x] Rule tests: screen-direction movement, falling, hopping, coconuts and lanes, monkeys, summit and bonus clock, track climbing
- [x] Render smoke test (no throw, no non-finite coordinates)
