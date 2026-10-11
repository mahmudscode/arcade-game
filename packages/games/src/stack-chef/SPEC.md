# Stack Chef (`stack-chef`)

**Catalog #:** 50 · **Archetype:** PF · **Status:** dev

## Pitch
Walk over the burger layers to drop them down and build four burgers.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Left / Right walk, Up / Down climb ladders, Space or Z throws pepper (5 per life, stuns foes ahead on the same floor for 4 s), Enter or Space restarts, P pauses. Touch: virtual pad + A / B.

## Rules
Four burgers, four layers each, on five floors joined by ladders. Walking over all four segments of a layer drops it one floor; a layer landing on another knocks that one down too, and a layer reaching the tray stacks there. Four layers on a tray complete a burger (1000); all four burgers clear the level. Foes chase using shortest paths over floors and ladders; a falling layer squashes foes beneath it (500) and they return later. There is no jumping. 3 lives.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON. Movement uses the shared tile physics in `_shared/platformer.ts` (tested in `platformer.test.ts`).

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`stack-chef.test.ts`)
- [x] Rule tests: walking, climbing, no jumping, treading and dropping, chain drops, stacking and completion, squashing, pepper, chasing, level layout
- [x] Render smoke test (no throw, no non-finite coordinates)
