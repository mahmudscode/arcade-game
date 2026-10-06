# Lunar Descent (`lunar-descent`)

**Catalog #:** 20 · **Archetype:** AR · **Size:** S · **Status:** dev

## 1. Pitch
Rotate and thrust a lander against gravity and set down gently on a landing pad.

## 2. Original identity
Original name and shapes drawn with canvas primitives on the shared night-sky palette. No historic sprites, audio or names (see LEGAL.md).

## 3. Controls
Arrows / A D move, Space / Z primary action, Enter or Space to restart, P pause. Touch: virtual pad + A.

## 4. Rules
- 800x570, 3 lives, limited fuel per attempt.
- Land slowly and level on a pad: points by pad multiplier plus fuel left. Touching anywhere else too fast or tilted is a crash.
- Terrain and pads come from `ctx.rng`; each level has less fuel and narrower pads.

## 5. Scoring
Integers, changed only inside `update`.

## 6. Determinism notes
All randomness uses `ctx.rng`; timers use `dt`. State is plain JSON.

## 7. Acceptance criteria
- [x] Deterministic replay test
- [x] Invariant and JSON round-trip tests
