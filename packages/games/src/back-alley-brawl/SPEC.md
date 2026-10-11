# Back-Alley Brawl (`back-alley-brawl`)

**Catalog #:** 61 · **Archetype:** BU · **Status:** dev

## Pitch
Fight through the alley and pick up weapons.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Arrows move (also into and out of the screen), Space or Z punches (three-hit combo, or a jump kick in the air), X jumps. Enter restarts, P pauses.

## Rules
Waves of thugs lock the screen until beaten, then "GO" sends you on. Crates and fallen foes drop food and knives or bats (limited uses). Only two foes attack at once and each winds up first. A boss closes the stage; a longer one follows. If no foes are left for 12 s, stragglers arrive. 3 lives.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON. Built on the `brawler` archetype (`_shared/brawler.ts`).

## Acceptance
- [x] Deterministic replay, invariant, JSON round-trip and "ends when idle" tests (`back-alley-brawl.test.ts`)
- [x] Rule tests: punch/combo knockdown, screen lock and release, stragglers, attack tokens, death
- [x] Render smoke test (no throw, no non-finite coordinates)
