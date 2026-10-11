# Orb Popper (`orb-popper`)

**Catalog #:** 92 · **Archetype:** GP · **Status:** dev

## Pitch
Aim and bounce coloured orbs into a hanging cluster; match three to pop them and cut off the rest.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Left / Right aim, Space or Up fires, X swaps the loaded orb with the next one, Enter or Space restarts, P pauses. Touch: virtual pad + A / B.

## Rules
Hex-packed board (11 / 10 per row) hanging from the ceiling. A shot flies in a straight line, bounces off the side walls, and sticks to the ceiling or the first orb it touches, snapping to the nearest empty cell. Three or more of a colour touching pop (10 each, +10 per extra). Anything no longer connected to the ceiling falls (30 each). After 4-7 shots without a pop (fewer at higher levels) the ceiling drops a new row; orbs on the bottom rows end the game. The loaded orb is always a colour still on the board. Clear the board for the next level.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON.

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`orb-popper.test.ts`)
- [x] Rule tests: sticking, matching, floating clusters, bounces, ceiling drop, game over, level clear, swap and aim limits
- [x] Render smoke test (no throw, no non-finite coordinates)
