# Altitude Raid (`altitude-raid`)

**Catalog #:** 13 · **Archetype:** SS · **Status:** dev

## Pitch
Fly an isometric fortress run where altitude decides what you can hit and what you can pass.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Left / Right steer across the lane, Up / Down climb and dive, Space or Z fires, Enter or Space restarts, P pauses. Touch: virtual pad + A / B.

## Rules
Diagonal isometric scrolling. Shots only hit things at their altitude: planes in the air (200), ground turrets and fuel tanks only when you are low (300 each); a fuel tank refills the gauge. Fuel drains constantly and an empty tank costs a life. Walls cross the lane with one opening: fly through it (100) or crash. Turrets and planes fire shots aimed at where you will be. A boss closes out each stage (14 hits, 6000), then the next stage is faster. 3 lives.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON. The projection is a pure function (`project`) so tests can check it.

## Acceptance
- [x] Deterministic replay, invariant, JSON round-trip and "ends when idle" tests (`altitude-raid.test.ts`)
- [x] Rule tests: projection, steering limits, altitude-dependent hits, fuel, walls and openings, aimed enemy fire, boss, spawning
- [x] Render smoke test (no throw, no non-finite coordinates)
