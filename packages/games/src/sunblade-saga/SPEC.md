# Sunblade Saga (`sunblade-saga`)

**Catalog #:** 69 · **Archetype:** BU · **Status:** dev

## Pitch
Long blade reach and screen-clearing magic.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Arrows move, Space or Z slashes, Up + attack spends pots to hit every foe on screen, X jumps. Enter restarts, P pauses.

## Rules
Same wave/boss flow with a longer reach and no pickable weapons. Crates and thieves drop magic pots (up to 6); magic damage grows with pots used (up to 3). 3 lives.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON. Built on the `brawler` archetype.

## Acceptance
- [x] Deterministic replay, invariant, JSON round-trip and "ends when idle" tests (`sunblade-saga.test.ts`)
- [x] Shared brawler rule tests
- [x] Render smoke test (no throw, no non-finite coordinates)
