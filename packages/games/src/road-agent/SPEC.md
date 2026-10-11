# Road Agent (`road-agent`)

**Catalog #:** 73 (Spy Hunter style) · **Archetype:** RT · **Status:** dev

## Pitch
Drive a gun-armed car down a winding road: shoot hostile cars, spare the civilians, and pick up missiles from weapon vans.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
See the in-game controls panel. Enter restarts, P pauses. Touch: virtual pad + A / B.

## Rules
A winding road scrolls down the screen. Hostile cars come from ahead and behind: switchblades swerve into you, road lords are armoured (missiles only) and shove you hard, and civilians must be spared (shooting one jams your guns for 4 s and costs points). Weapon vans give 4 missiles when driven into. Leaving the road wrecks the car. 3 lives; the road narrows and gets twistier each zone.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON.

## Acceptance
- [x] Deterministic replay, invariant, JSON round-trip and "ends when idle" tests (`road-agent.test.ts`)
- [x] Rule tests for the archetype's mechanics
- [x] Render smoke test (no throw, no non-finite coordinates)
