# Bomb Hopper (`bomb-hopper`)

**Catalog #:** 56 · **Archetype:** PF · **Status:** dev

## Pitch
Leap and glide around one screen collecting every bomb.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Left / Right run, Space / Up / Z jump (hold while falling to glide), Down drops through a platform, Enter or Space restarts, P pauses. Touch: virtual pad + A / B.

## Rules
24 bombs scattered on and above six one-way platforms; one flashes. Taking the flashing bomb pays 300 (else 100) and lights the nearest remaining one. Patrollers walk their platform; flyers bounce around and drift toward you. Touching one costs a life. A power ball appears on a platform now and then; with it, touching enemies scores 200, 400, 800 and sends them away for 5 s. Collect every bomb to clear the level. 3 lives.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON. Movement uses the shared tile physics in `_shared/platformer.ts` (tested in `platformer.test.ts`).

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`bomb-hopper.test.ts`)
- [x] Rule tests: one-way platforms, gliding, bomb scoring and lighting, level clear, patrols and flyers, power ball, bounds, bomb generation
- [x] Render smoke test (no throw, no non-finite coordinates)
