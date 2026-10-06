# Sky Shield (`sky-shield`)

**Catalog #:** 11 · **Archetype:** FS · **Size:** S · **Status:** dev

## 1. Pitch
Move a crosshair and launch interceptors to blow up incoming missiles before they flatten your six cities.

## 2. Original identity
Original name and shapes drawn with canvas primitives on the shared night-sky palette. No historic sprites, audio or names (see LEGAL.md).

## 3. Controls
Arrows / A D move, Space / Z primary action, Enter or Space to restart, P pause. Touch: virtual pad + A.

## 4. Rules
- 800x570, six cities, 10 interceptors per wave.
- Interceptors fly to the crosshair and burst; bursts destroy missiles they touch.
- Game over when all cities are lost. End-of-wave bonus for surviving cities and unused interceptors.

## 5. Scoring
Integers, changed only inside `update`.

## 6. Determinism notes
All randomness uses `ctx.rng`; timers use `dt`. State is plain JSON.

## 7. Acceptance criteria
- [x] Deterministic replay test
- [x] Invariant and JSON round-trip tests
