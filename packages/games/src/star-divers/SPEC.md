# Star Divers (`star-divers`)

**Catalog #:** 9 · **Archetype:** FS · **Size:** S · **Status:** dev

## 1. Pitch
Shoot a hovering formation of aliens while single ships peel off and dive at you.

## 2. Original identity
Original name and shapes drawn with canvas primitives on the shared night-sky palette. No historic sprites, audio or names (see LEGAL.md).

## 3. Controls
Arrows / A D move, Space / Z primary action, Enter or Space to restart, P pause. Touch: virtual pad + A.

## 4. Rules
- 800x570, 3 lives, extra life every 10000, two shots on screen.
- Formation sways; random ships dive in a sine path and return or fly off and re-enter. Divers score double.
- Clear the formation for the next wave, which dives more often.

## 5. Scoring
Integers, changed only inside `update`.

## 6. Determinism notes
All randomness uses `ctx.rng`; timers use `dt`. State is plain JSON.

## 7. Acceptance criteria
- [x] Deterministic replay test
- [x] Invariant and JSON round-trip tests
