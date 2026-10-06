# Core Crusher (`core-crusher`)

**Catalog #:** 19 · **Archetype:** AR · **Status:** dev

## Pitch
Shoot gaps through three rotating shields to hit the cannon at the core.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
◀ ▶ = Rotate; ▲ = Thrust; Space = Fire. Enter or Space restarts after game over, P pauses.

## Rules
Thrust ship with screen wrap. Three rings of 8/12/16 segments spin around a core that fires at you; a shot reaching the core clears the wave (+1000).

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON.

## Acceptance
- [x] Deterministic replay, invariant and JSON round-trip tests (`core-crusher.test.ts`)
