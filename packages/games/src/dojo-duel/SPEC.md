# Dojo Duel (`dojo-duel`)

**Catalog #:** 71 (Karate Champ style) · **Archetype:** FT · **Status:** dev

## Pitch
A karate duel scored in points: the first clean hit wins the exchange; first to four takes the round.

## Original identity
Original name and fighters; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
See the in-game controls panel. Enter restarts, P pauses. Touch: virtual pad + A / B.

## Rules
As Arena Masters but with no health: each clean, unblocked hit scores one point, then both fighters reset. The first to four points takes the round; best of three rounds; if time runs out, more points wins. No fireballs. 3 lives.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness (including the opponent's decisions) uses `ctx.rng`; timers use `dt`; state is plain JSON. Built on the `fighter` archetype.

## Acceptance
- [x] Deterministic replay, invariant, JSON round-trip and "ends when idle" tests (`dojo-duel.test.ts`)
- [x] Rule tests for the archetype's mechanics
- [x] Render smoke test (no throw, no non-finite coordinates)
