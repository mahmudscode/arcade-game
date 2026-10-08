# Tile Catcher (`tile-catcher`)

**Catalog #:** 94 (Klax style) · **Archetype:** FB · **Size:** M · **Status:** dev

## 1. Pitch
Catch coloured tiles rolling down a conveyor on a paddle and stack them into a bin to line up three of a colour.

## 2. Original identity
Original name and shapes drawn with canvas primitives on the shared night-sky palette (`_shared/ui.ts`). No historic sprites, audio or names (see LEGAL.md).

## 3. Core loop
1. Tiles roll down five lanes; slide the paddle under them to catch up to five.
2. Drop the top tile into the bin column under the paddle.
3. Three or more of a colour in a row, column or diagonal vanish and the rest fall.
4. Chains of clears multiply the score.
5. Reach the tile goal to move up a level.

## 4. Controls
| Action | Keyboard | Touch |
|---|---|---|
| Move paddle | Left / Right | virtual pad |
| Toss top tile | Space / Z / Up | A |
| Drop to bin | Down / X | B |
| Start / restart | Enter / Space | A |

## 5. Rules
- Logical resolution 800x570.
- A tile missed off the end of the conveyor costs a life; so does a jammed bin (which is then wiped).
- 3 lives, extra life every 10000.
- Goal is 24 tiles cleared per level; more colours appear as levels rise.

## 6. Entities
| Entity | Behavior / points |
|---|---|
| Cleared tile | 100 x chain, +500 for 5 or more at once |
| Level bonus | 1000 |

## 7. Scoring
Integer, only changed in `update`.

## 8. Determinism notes
All randomness uses `ctx.rng`; all timing uses `dt`. State is plain JSON.

## 9. Assets
Canvas-drawn shapes. SFX: fire, explode, die, pickup, wave, start.

## 10. Edge cases
Pause is handled by the session. Restart re-inits with the stored hi-score.

## 11. Acceptance criteria
- [x] Deterministic replay test
- [x] Invariant and JSON round-trip tests
