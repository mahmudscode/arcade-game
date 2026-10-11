# Vault Delver (`vault-delver`)

**Catalog #:** 70 · **Archetype:** AR · **Status:** dev

## Pitch
Shoot through a monster-filled dungeon, smash the spawners, take the key and escape the vault.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Arrows move (8-way), hold Space or Z to shoot, X drinks a potion (clears nearby monsters), Enter or Space restarts, P pauses. Touch: virtual pad + A / B.

## Rules
21x15 pillared dungeon (always connected). Spawners release ghosts, grunts and (from level 3) ranged demons; monsters follow a breadth-first flow field around walls. Touching a monster drains health; health also drains 1 per second. Food heals, treasure scores, potions clear a radius and hurt spawners, and the single key opens the door to the exit vault. Game over at zero health.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON.

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`vault-delver.test.ts`)
- [x] Rule tests: movement and sliding, shooting, spawners, contact drain, health drain, doors and keys, items, potions, pathing, demons, exit and level generation
- [x] Render smoke test (no throw, no non-finite coordinates)
