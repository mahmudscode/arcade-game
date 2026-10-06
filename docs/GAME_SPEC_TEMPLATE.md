# Game Spec Template

Copy to `packages/games/<slug>/SPEC.md` and fill in **before** coding. Keep it to 1-2 pages.

---

# <Game Title> (`<slug>`)

**Catalog #:** · **Archetype:** · **Size:** S/M/L · **Owner:** · **Status:**

## 1. Pitch
One sentence: what the player does and why it is fun.

## 2. Original identity
Renamed title (if needed), art direction, palette, sound mood. State what is intentionally different from the historic game (see [LEGAL.md](LEGAL.md)).

## 3. Core loop
Numbered steps of a typical 30-second play.

## 4. Controls
| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Move | Arrows / WASD | D-pad / stick | virtual pad |
| Primary (A) | Space / Z | A | button |
| Secondary (B) | X | B | button |
| Start / pause | Enter / Esc | Start | menu |

## 5. Rules
- Logical resolution:
- Lives / continues:
- Win / lose conditions:
- Level structure and how difficulty ramps (table of levels 1-10 if relevant):

## 6. Entities
| Entity | Behavior | Speed/size | Points |
|---|---|---|---|

Include AI rules for enemies (state machine or targeting logic).

## 7. Scoring
Point values, multipliers, extra-life thresholds. The score must be an integer computed only from `update`.

## 8. Determinism notes
Every random choice uses `ctx.rng`. List any place where timing or ordering could cause divergence.

## 9. Assets
Sprites (list and size), tiles, SFX events -> synth presets, music loop.

## 10. Edge cases
Pause, window blur, restart, max score overflow, simultaneous collisions.

## 11. Acceptance criteria
- [ ] Plays from start to game over without errors
- [ ] 60 FPS on reference mid-range phone
- [ ] Deterministic: same seed + inputs -> same score (replay test)
- [ ] All controls work on keyboard, gamepad, touch
- [ ] Chunk size within budget
- [ ] Reduced-motion respected
- [ ] Spec reviewed against the original feel
