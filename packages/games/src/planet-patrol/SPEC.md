# Planet Patrol (`planet-patrol`)

**Catalog #:** 5 · **Archetype:** DF · **Status:** dev

## Pitch
Protect ten humanoids on a long wrapping planet from abducting landers.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Left / Right thrust and face that way, Up / Down change altitude, Space or Z fires, X uses a smart bomb (3 per life, +1 per extra life), Enter or Space restarts, P pauses. Touch: virtual pad + A / B.

## Rules
A 3200-pixel planet that wraps around, with a radar strip showing all of it. Landers fly to a humanoid, carry it up, and turn into fast shooting mutants if they reach the top. Shoot a carrying lander and the humanoid falls: catch it (500) and set it on the ground (500), or it lands safely from a short drop (250) and dies from a long one. Lose every humanoid and the planet explodes: the ground disappears and landers become mutants. A smart bomb clears everything on screen. Baiters hunt you if a wave takes over 45 s. Surviving humanoids pay 100 x wave when the wave is cleared. 3 lives.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON. Both games are the `defender` archetype in `_shared/defender.ts` with different configs; most rules are tested in each game's own test file.

## Acceptance
- [x] Deterministic replay, invariant, JSON round-trip and "ends when idle" tests (`planet-patrol.test.ts`)
- [x] Rule tests: thrust and inertia, wrap-around distance, flying limits, shooting, abduction and mutation, rescuing, falling, smart bomb, planet destruction, baiters, wave progression
- [x] Render smoke test (no throw, no non-finite coordinates)
