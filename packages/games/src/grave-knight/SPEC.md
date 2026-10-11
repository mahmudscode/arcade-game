# Grave Knight (`grave-knight`)

**Catalog #:** 53 · **Archetype:** SC · **Status:** dev

## Pitch
Throw lances through a haunted graveyard; armour takes the first hit.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Left / Right move, X or Up jumps, Space or Z attacks, Enter or Space restarts, P pauses. Touch: virtual pad + A / B.

## Rules
A generated side-scrolling stage of ground with pits, one-row steps, spikes and floating ledges. Enemies sleep until you get within 17 tiles. A boss waits in a flat arena at the end; beating it opens the flag, and reaching the flag clears the stage (a longer one follows). A stage clock runs down (out of time costs a life but gives another minute). Checkpoints every 45 tiles; pits and spikes hurt. 3 lives. Lances fly straight (two at once). Zombies keep rising from the ground ahead of you (up to six). The first hit costs your armour, the second a life.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON. Built on the `side-scroller` archetype (`_shared/side-scroller.ts`) with the config exported from its `index.ts`; the archetype's rules are tested in every game that uses it.

## Acceptance
- [x] Deterministic replay, invariant, JSON round-trip and "ends when idle" tests (`grave-knight.test.ts`)
- [x] Rule tests: generation validity, movement and jump height, steps and pits, spikes, the weapon, enemy kinds, hit points and respawn, the boss and flag, the stage clock, rising zombies, armour
- [x] Render smoke test (no throw, no non-finite coordinates)
