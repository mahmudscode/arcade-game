# Outpost Raid (`outpost-raid`)

**Catalog #:** 24 · **Archetype:** AR · **Status:** dev

## Pitch
Fly in eight directions over a wrapping star map, blast gun pods and slip shots through the gaps into enemy base cores.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Arrows / WASD steer in 8 directions (the ship keeps flying along its last heading), Space or Z fires ahead and astern, Enter or Space restarts, P pauses. Touch: virtual pad + A / B.

## Rules
A 2400x2400 world that wraps on both axes, with a radar. Each base has a core ringed by six gun pods; pods are solid and shoot aimed shots at close range, so shots only reach the core through the gaps between them. Fighters spawn near you and chase; mines sit still. Destroy every core to finish the round (+1000); the next round has more bases. 3 lives, extra life every 20,000.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON.

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`outpost-raid.test.ts`)
- [x] Rule tests: pod 200 / core 1500 / fighter 100 / mine 50, wrap-around flight, 8-way steering, rear fire, invulnerability, round progression, enemy fire cleared safely on death
- [x] Render smoke test (no throw, no non-finite coordinates)
