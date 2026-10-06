# Highway Hero (`highway-hero`)

**Catalog #:** 81 · **Archetype:** RT · **Status:** dev

## Pitch
Dodge traffic and oil slicks, refuel on the move and reach the goal.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
◀ ▶ = Steer; ▲ Space = Accelerate; ▼ X = Brake. Enter or Space restarts after game over, P pauses.

## Rules
Top-down vertical racer: fuel drains with speed; fuel cans refill, oil makes you skid, cars crash you. 3 lives.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON.

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`highway-hero.test.ts`)
