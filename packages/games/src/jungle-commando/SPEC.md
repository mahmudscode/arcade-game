# Jungle Commando (`jungle-commando`)

**Catalog #:** 60 · **Archetype:** SC · **Status:** dev

## Pitch
Run and gun in eight directions; one hit kills.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Left / Right run, Up / Down aim (Down on the ground lies flat), X jumps, Space or Z fires (hold). Enter restarts, P pauses. Touch: virtual pad + A / B.

## Rules
The side-scroller stage (pits, spikes, ledges, stage clock, checkpoints, boss and flag) with runners that charge, shooters and flyers. Fire is held for rapid shots in eight directions; lying flat shrinks you under bullets; a power pickup turns your shot into a three-way spread. 3 lives, one hit point.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON. Built on the `side-scroller` archetype with the `aim8` and `prone` options.

## Acceptance
- [x] Deterministic replay, invariant, JSON round-trip and "ends when idle" tests (`jungle-commando.test.ts`)
- [x] Rule tests: eight-way aim, prone, spread gun, runner enemies, plus the shared side-scroller rules
- [x] Render smoke test (no throw, no non-finite coordinates)
