# Capsule Clinic (`capsule-clinic`)

**Catalog #:** 89 · **Archetype:** FB · **Status:** dev

## Pitch
Drop two-colour capsules into a bottle and line up four of a colour to wipe out every germ.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Arrows / A D / W S, Space or Z = primary (A, rotate), X = secondary (B, rotate back), Down = soft drop, Enter or Space restarts, P pauses. Touch: virtual pad + A / B.

## Rules
8x16 bottle, 3 colours. Each level seeds germs in the lower rows (never as a ready-made triple), 4 on level 1 and +2 per level. A capsule is two joined halves; line up 4+ of one colour horizontally or vertically to clear them. A half whose partner is cleared becomes loose and falls on its own; capsules fall joined. Clearing every germ finishes the level. Game over when a new capsule cannot spawn.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON. Shared key auto-repeat and rotation offsets live in `_shared/falling.ts`.

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`capsule-clinic.test.ts`)
- [x] Rule tests: matches, gravity and level clear
