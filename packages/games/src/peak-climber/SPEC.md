# Peak Climber (`peak-climber`)

**Catalog #:** 47 · **Archetype:** SC · **Status:** dev

## Pitch
Jump up through brick floors to climb a mountain.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Left / Right walk, X or Up jumps (and knocks out a brick you hit from below), Space or Z swings the hammer, Enter or Space restarts, P pauses. Touch: virtual pad + A / B.

## Rules
A mountain of solid brick floors three tiles apart, each with a few openings. Jumping into a brick from below knocks it out (10), so you can make your own way up. Reaching a new floor scores 100. Seals walk the floors and plug open gaps with ice (breakable the same way); birds swoop across at your height. The hammer defeats a seal (400) or a bird (800). Reach the top floor to climb the next, taller mountain. 3 lives.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON. Movement uses the shared tile physics in `_shared/platformer.ts`, with the floors laid out in negative y (up).

## Acceptance
- [x] Deterministic replay, invariant, JSON round-trip and "ends when idle" tests (`peak-climber.test.ts`)
- [x] Rule tests: knocking out bricks, climbing through gaps, ice, seals and birds, the hammer, falling back and restarting, summit and next mountain
- [x] Render smoke test (no throw, no non-finite coordinates)
