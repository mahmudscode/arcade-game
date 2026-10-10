# Crypt Crawler (`crypt-crawler`)

**Catalog #:** 36 · **Archetype:** MZ · **Status:** dev

## Pitch
Prowl a monster-filled dungeon, use the radar and shoot first.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Arrows / WASD move, Space or Z fires (one shot in flight), Enter or Space restarts, P pauses. Touch: virtual pad + A / B.

## Rules
19x11 dungeon of pillars and random walls, always fully connected. Three monster tiers: blue (100), yellow (200, invisible on screen unless within 4.5 tiles but always on the radar) and red (500, fast, fires often). Monsters hunt you, fire along clear lines, and speed up when two or fewer remain. Clear the dungeon for the next, bigger one. 3 lives.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON. Tile movement uses `_shared/walker.ts`.

## Acceptance
- [x] Deterministic replay, invariant, JSON round-trip and "ends when idle" tests (`crypt-crawler.test.ts`)
- [x] Rule tests: tier scoring, walls blocking shots, monster fire, touch kills, rush, dungeon connectivity, visibility
- [x] Render smoke test (no throw, no non-finite coordinates)
