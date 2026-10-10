# Orchard Digger (`orchard-digger`)

**Catalog #:** 31 · **Archetype:** MZ · **Status:** dev

## Pitch
Dig tunnels through the dirt, pick every cherry and drop apples on the grubs.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Arrows / WASD move, digging happens by walking, Space or Z throws the power ball, Enter or Space restarts, P pauses. Touch: virtual pad + A / B.

## Rules
17x13 dirt field. Walking digs; cherries are 50 each. Apples sit in pockets: undermine one and it wobbles, then falls, crushing grubs (1000, doubling) or you. An apple that drops two or more cells smashes. Apples can be shoved sideways into open tunnel. One power ball at a time bounces through tunnels and defeats a grub (500), then recharges. Grubs come out of the den and chase through the tunnels; after 16 s one learns to dig. Take every cherry or defeat every grub to advance. 3 lives.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON. Tile movement uses `_shared/walker.ts`.

## Acceptance
- [x] Deterministic replay, invariant, JSON round-trip and "ends when idle" tests (`orchard-digger.test.ts`)
- [x] Rule tests: digging, apple wobble/fall/smash/crush, pushing, the ball, grub chase and digging, level clear
- [x] Render smoke test (no throw, no non-finite coordinates)
