# Portal Patrol (`portal-patrol`)

**Catalog #:** 25 · **Archetype:** DF · **Status:** dev

## Pitch
Defend the planet again, now against mine-laying bombers and pods that burst into swarmers.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Left / Right thrust and face that way, Up / Down change altitude, Space or Z fires, X uses a smart bomb (3 per life, +1 per extra life), Enter or Space restarts, P pauses. Touch: virtual pad + A / B.

## Rules
Everything in Planet Patrol, plus bombers (from wave 2) that drift and lay mines, and pods (from wave 3) that burst into four swarmers when shot (1000) but vanish cleanly to a smart bomb. A mine kills the ship on contact but a laser shot destroys it (25).

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON. Both games are the `defender` archetype in `_shared/defender.ts` with different configs; most rules are tested in each game's own test file.

## Acceptance
- [x] Deterministic replay, invariant, JSON round-trip and "ends when idle" tests (`portal-patrol.test.ts`)
- [x] Rule tests: all of the planet rules plus mines and their destruction, pods and swarmers, enemy introduction by wave
- [x] Render smoke test (no throw, no non-finite coordinates)
