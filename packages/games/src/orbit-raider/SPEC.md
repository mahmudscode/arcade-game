# Orbit Raider (`orbit-raider`)

**Catalog #:** 15 · **Archetype:** SS · **Status:** dev

## Pitch
Collect pickups to upgrade your shot, then gain trailing option orbs that fire with you.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
◀ ▶ ▲ ▼ = Fly; Space = Fire (hold). Enter or Space restarts after game over, P pauses.

## Rules
Horizontal scroller where pickups raise shot power to 3-way, then add up to two trailing options.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON.

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`orbit-raider.test.ts`)
