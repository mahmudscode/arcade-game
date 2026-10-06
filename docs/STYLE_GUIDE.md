# Style Guide

## Code
- TypeScript `strict`, no `any` without a comment. ES modules only.
- Files: `kebab-case.ts`; types/classes `PascalCase`; functions/vars `camelCase`; constants `SCREAMING_SNAKE`.
- Game slugs are kebab-case and **never change** after release (`pac-man`, `bomb-jack`).
- Game folder layout:
  ```
  packages/games/<slug>/
  ├── SPEC.md
  ├── index.ts          # exports GameDefinition
  ├── state.ts          # state types
  ├── update.ts         # logic
  ├── render.ts
  ├── assets/           # sprites as code/data, small
  └── __tests__/        # determinism, replay, invariants
  ```
- Inside games: no DOM, no globals, no `Math.random` / `Date.now`. All randomness via `ctx.rng`, all time via `dt`.
- Hot loops: prefer object pools and typed arrays; avoid per-frame allocation.
- Comments explain *why*, not *what*. Keep functions short; extract archetype behavior instead of copy-pasting between games.
- Commits: Conventional Commits (`feat(pac-man): ghost scatter mode`). One game or one concern per PR.

## Visual direction
Modern reimagining of classic games, not pixel-perfect copies.
- Dark backgrounds, strong neon accents, consistent glow via the renderer (`r.glow(color, blur)`), never ad-hoc `shadowBlur`.
- Each game has a 5-color palette defined in its spec; UI shell uses CSS variables:
  `--bg`, `--surface`, `--text`, `--accent`, `--danger`.
- Motion: particles on key events, small screen shake (disabled with reduced motion), 150-250 ms UI transitions.
- Typography: one pixel/display font for headings and HUD, one readable sans for UI text.
- HUD standard: score top-left, lives top-right, level bottom-left; consistent across games.
- Contrast ratio >= 4.5:1 for text; never rely on color alone for critical information.

## Audio
Procedural only (Web Audio): square/triangle/noise presets, short sequencer loops. Master volume and mute persist in settings. Audio starts only after a user gesture.

## UX
- Every game: title screen, how-to-play (controls), pause menu, game over with submit-score button, restart in one key.
- Keyboard focus visible everywhere; all UI operable without a mouse.
- Touch overlay appears only on touch devices; layouts tested at 360 px width.
