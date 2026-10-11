# Bubble Brawler (`bubble-brawler`)

**Catalog #:** 43 · **Archetype:** PF · **Status:** dev

## Pitch
Trap monsters in bubbles, pop them for fruit, and clear the round before the ghost comes.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Left / Right run, Space or Up jumps (you can jump up through platforms), X blows a bubble, Down drops through a platform, Enter or Space restarts, P pauses. Touch: virtual pad + A / B.

## Rules
Single-screen rounds on one-way platforms (three layouts). A bubble flies out then drifts up; one that touches a monster traps it. Touch a trapped bubble to pop it (100) and drop fruit (500+); an untouched trap breaks after 7 s and the monster gets angry and fast. Empty bubbles pop on touch (10). After 45 s a ghost hunts you. Touching a monster costs a life. Clear every monster for the round bonus. 3 lives.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON. Movement uses the shared tile physics in `_shared/platformer.ts` (tested in `platformer.test.ts`).

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`bubble-brawler.test.ts`)
- [x] Rule tests: bubble flight, trapping, popping and fruit, escape, empty bubbles, enemy contact, hurry ghost, round clear
- [x] Render smoke test (no throw, no non-finite coordinates)
