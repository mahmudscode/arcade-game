# Skyline Stomper (`skyline-stomper`)

**Catalog #:** 72 · **Archetype:** AR · **Status:** dev

## Pitch
Climb the towers, smash every window and flatten the city while the army fights back.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Left / Right walk or climb sideways, Up / Down climb, Space or Z punches, Enter or Space restarts, P pauses. Touch: virtual pad + A / B.

## Rules
Three buildings of 4 columns; windows take two punches (a punch also hits the window above). Eating a person in a broken window scores 100 and heals. A building falls at 70% broken windows (1000; a climber rides it down). Tanks on the ground shell you, helicopters strafe, snipers hide in windows; punch a tank or swat a helicopter for points. 100 health per life, 3 lives; flattening all three buildings starts the next city.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON.

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`skyline-stomper.test.ts`)
- [x] Rule tests: ground and climbing movement, window hits, eating people, collapse, level progression, tanks, choppers, snipers, damage and respawn
- [x] Render smoke test (no throw, no non-finite coordinates)
