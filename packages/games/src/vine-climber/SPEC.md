# Vine Climber (`vine-climber`)

**Catalog #:** 41 · **Archetype:** PF · **Status:** dev

## Pitch
Swing between jungle vines to the key, dropping fruit on the snapjaws.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Left / Right run, Up / Down climb vines, Space or Z jumps (also off a vine toward the next one), Enter or Space restarts, P pauses. Touch: virtual pad + A / B.

## Rules
Eight vines three tiles apart over island platforms. Touching hanging fruit shakes it loose (100); fruit falling on a snapjaw flattens it (400). Snapjaws patrol islands or slide up and down vines; touching one costs a life. Reach the key on the top platform before the bonus clock runs out. Jumping off a vine holding Up does not re-grab it immediately. 3 lives.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON. Movement uses the shared tile physics in `_shared/platformer.ts` (tested in `platformer.test.ts`).

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`vine-climber.test.ts`)
- [x] Rule tests: climbing and vine-to-vine jumps, fruit, snapjaws, key and bonus clock, fruit generation
- [x] Render smoke test (no throw, no non-finite coordinates)
