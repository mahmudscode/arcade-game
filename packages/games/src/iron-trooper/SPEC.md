# Iron Trooper (`iron-trooper`)

**Catalog #:** 66 · **Archetype:** RG · **Status:** dev

## Pitch
Run-and-gun with tanks to commandeer.

## Original identity
Original name; shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## Controls
Arrows move and aim (eight directions), Space or Z fires (hold), X lobs a grenade over cover. Enter restarts, P pauses. Touch: virtual pad + A / B.

## Rules
A long vertical stage that scrolls up (never back). Soldiers close in and strafe, firing telegraphed shots (at most three winding up at once); runners charge; grenadiers lob grenades at your position; bunkers need grenades or sustained fire. Cover blocks movement and bullets. Pickups: grenades, a three-way spread shot, prisoners (1000). Tank pickups (2 per stage) let you ride a tank that takes four hits, fires twice as hard and moves slower; when it is destroyed it blasts nearby foes. A fortress boss ends the stage; a harder one follows. A stage clock punishes stalling (out of time costs a life). 3 lives.

## Scoring and determinism
Score is an integer changed only in `update`. All randomness uses `ctx.rng`; timers use `dt`; state is plain JSON. Built on the `gunner` archetype (`_shared/gunner.ts`).

## Acceptance
- [x] Deterministic replay, invariant, JSON round-trip and "ends when idle" tests (`iron-trooper.test.ts`)
- [x] Rule tests: aim and fire, cover, grenades, one-hit death, stage clock, forward-only camera
- [x] Render smoke test (no throw, no non-finite coordinates)
