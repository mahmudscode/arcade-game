# Sailor Slugger (`sailor-slugger`)

**Catalog #:** 45 · **Archetype:** PF · **Status:** dev

## Pitch
Catch the hearts falling toward the sea while a bruiser hunts you.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Left / Right run, Up / Down stairs, Space or Z punches (there is no jump), Enter or Space restarts, P pauses. Touch: virtual pad + A / B.

## Rules
Three floors joined by stairs, over water. Hearts drift down; stand under one to catch it (100 x round, up to 5x). Three hearts lost to the sea cost a life. The bruiser chases over stairs; touching him costs a life, a punch stuns him for 1.4 s. Spinach (appears now and then) powers you up for 6 s: a punch or touch then knocks him into the sea (1000) and he returns after 8 s. Catch 16 hearts to clear the round. 3 lives.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON. Movement uses the shared tile physics in `_shared/platformer.ts` (tested in `platformer.test.ts`).

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`sailor-slugger.test.ts`)
- [x] Rule tests: stairs, no jumping, heart catching and losing, punching and stunning, spinach power, chase across floors, round clear
- [x] Render smoke test (no throw, no non-finite coordinates)
