# Dirt Rider (`dirt-rider`)

**Catalog #:** 80 · **Archetype:** SC · **Status:** dev

## Pitch
Race a dirt bike over ramps and hurdles without overheating.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Space is the throttle, X is turbo (hotter), Up / Down change lane on the ground and tilt the nose in the air, Enter or Space restarts, P pauses. Touch: virtual pad + A / B.

## Rules
A three-lane track with ramps, hurdles, mud, speed strips and cooling strips, and rival bikes. The engine heats with the throttle (turbo much faster); at 100 it cuts out until it cools. A ramp launches you; in the air the nose rises by itself, and landing with it too high or too low is a crash (a big jump needs a tap of Down). Hurdles crash you; mud slows you; running into a rival slows you. Cross the finish line before the time limit for a time bonus and a longer race; running out of time costs a life. 3 lives.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON. A side view of a one-dimensional track; positions are distances along it.

## Acceptance
- [x] Deterministic replay, invariant, JSON round-trip and "ends when idle" tests (`dirt-rider.test.ts`)
- [x] Rule tests: throttle and turbo, heat and stalling, lanes, ramps and landings, hurdles, mud, strips, rivals, finish and time limit
- [x] Render smoke test (no throw, no non-finite coordinates)
