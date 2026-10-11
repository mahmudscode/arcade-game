# Arena Masters (`arena-masters`)

**Catalog #:** 63 (Street Fighter II style) · **Archetype:** FT · **Status:** dev

## Pitch
Square off one-on-one: punches, kicks, sweeps and a fireball (Down, Forward, Punch). Win two rounds against a ladder of tougher fighters.

## Original identity
Original name and fighters; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
See the in-game controls panel. Enter restarts, P pauses. Touch: virtual pad + A / B.

## Rules
One-on-one, best of three rounds, 60 s each. Health bars; punches (fast, high), kicks (slower, stronger), crouching kicks (low, knock down) and air kicks. Holding back blocks high attacks standing and low attacks crouching; blocked fireballs still chip. A crouch avoids punches. After a hit the victim is briefly invulnerable so there are no infinite combos. The fireball needs Down, Forward, Punch within half a second; one on screen per fighter. Time up: more health wins. Win the match for a tougher opponent; lose it and a life goes. 3 lives.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness (including the opponent's decisions) uses `ctx.rng`; timers use `dt`; state is plain JSON. Built on the `fighter` archetype.

## Acceptance
- [x] Deterministic replay, invariant, JSON round-trip and "ends when idle" tests (`arena-masters.test.ts`)
- [x] Rule tests for the archetype's mechanics
- [x] Render smoke test (no throw, no non-finite coordinates)
