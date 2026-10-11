# Metro Rumble (`metro-rumble`)

**Catalog #:** 64 · **Archetype:** BU · **Status:** dev

## Pitch
Heavy hitters with a costly spin attack.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Arrows move, Space or Z punches, Down + punch spins (costs health, brief invulnerability), X jumps. Enter restarts, P pauses.

## Rules
As Back-Alley Brawl with tougher enemies, thieves that flee dropping food, and a spin that hits everything near you for health. 3 lives.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON. Built on the `brawler` archetype.

## Acceptance
- [x] Deterministic replay, invariant, JSON round-trip and "ends when idle" tests (`metro-rumble.test.ts`)
- [x] Shared brawler rule tests
- [x] Render smoke test (no throw, no non-finite coordinates)
