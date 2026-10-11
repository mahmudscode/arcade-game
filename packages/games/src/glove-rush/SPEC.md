# Glove Rush (`glove-rush`)

**Catalog #:** 87 (Punch-Out style) · **Archetype:** FT · **Status:** dev

## Pitch
Read the wind-up, lean away from the glove, counter while he is open, and spend stars on an uppercut.

## Original identity
Original name and fighters; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
See the in-game controls panel. Enter restarts, P pauses. Touch: virtual pad + A / B.

## Rules
You see the opponent from behind. Each attack winds up with a visible tell (which glove, head or body); lean to the opposite side as the strike lands to dodge it and leave him open for over a second. He also guards head or body while ready: punches at the guarded height do nothing and leave you exposed. Hits on an open opponent do triple damage; the first one earns a star (up to three), and Up + head punch spends one on a big uppercut. Three knockdowns in a bout is a TKO. If you go down, mash A to get up; three knockdowns or failing to get up loses the bout. Three rounds; a decision if nobody falls. 3 lives; tells shorten each bout.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness (including the opponent's decisions) uses `ctx.rng`; timers use `dt`; state is plain JSON. Built on the `boxer` archetype.

## Acceptance
- [x] Deterministic replay, invariant, JSON round-trip and "ends when idle" tests (`glove-rush.test.ts`)
- [x] Rule tests for the archetype's mechanics
- [x] Render smoke test (no throw, no non-finite coordinates)
