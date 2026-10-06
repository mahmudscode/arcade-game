# Design: Arcade Hub

Source: exported Figma screens in [docs/design/](design/) (`Arcade_Hub_All_Screens.png` is the overview; `00_Style_guide` through `05_Mobile-Game_player` are the individual screens as PNG and SVG).

## Tokens (implemented in `apps/web/src/styles.css`)
| Token | Hex | Use |
|---|---|---|
| ink | `#1A1033` | page background |
| ink-2 | `#24184A` | surfaces, cards |
| ink-3 | `#33255F` | raised elements |
| line | `#4A3A80` | borders |
| paper | `#F6EFFF` | primary text |
| muted | `#B7A9DB` | secondary text |
| gold | `#FFC93C` | marquee, primary buttons, active state |
| coral | `#FF5D73` | accents, A button |
| cyan | `#4FE3D6` | progress, links, "you" |

Fonts (self-hosted via Fontsource, OFL): **Press Start 2P** for logo, display and HUD; **Rubik** for everything else.

## Responsive rules
| Breakpoint | Columns | Gap | Side margin | Navigation |
|---|---|---|---|---|
| Desktop >= 1200px | 6 | 24 | 80 | top nav + search |
| Tablet 768-1199px | 4 | 20 | 40 | search + avatar, horizontal-scroll rows |
| Mobile < 768px | 2 | 14 | 20 | bottom tab bar, on-screen controller |

## Screens and where they live
| Screen | Implementation |
|---|---|
| Home (desktop / tablet / mobile) | `pages/Home.tsx`, `components/Hero`, `CategoryChips`, `ContinuePlaying`, `GameCard`, `TabBar` |
| Game player (desktop) | `pages/Player.tsx` (canvas frame, control bar, side panel) |
| Game player (mobile) | `pages/Player.tsx` + `components/TouchPad.tsx` |

## Known differences from the design
- Card thumbnails are generated pixel creatures (`components/Sprite.tsx`) until real art exists.
- The design's "124 games" is placeholder copy; counts shown are the real catalog size.
- Top scores are sample data until the leaderboard API exists (labelled in the UI).
- The design's "two-player co-op" is not built; Comet Crusher is single player.
- Hover thumbnail 3 s preview loop is not built yet.
