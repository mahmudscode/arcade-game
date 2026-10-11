# Tower Monk (`tower-monk`)

**Catalog #:** 62 · **Archetype:** BU · **Status:** dev

## Pitch
One corridor, grippers and knife throwers.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Left / Right walk, Down ducks, Space or Z strikes, X jumps, mash Left / Right to break a grab. Enter restarts, P pauses.

## Rules
A single-lane brawler: no depth movement. Grippers grab and drain health until you shake free; throwers keep their distance and throw knives at head height (duck) or shin height (jump). Waves lock the screen and a boss ends each floor. 3 lives.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON. Built on the `brawler` archetype with `lanes: false`.

## Acceptance
- [x] Deterministic replay, invariant, JSON round-trip and "ends when idle" tests (`tower-monk.test.ts`)
- [x] Shared brawler rule tests
- [x] Render smoke test (no throw, no non-finite coordinates)
