# Roadmap

Strategy: **platform first, then archetype by archetype.** Building an archetype once and shipping every game on it is far cheaper than going game by game. No dates; milestones are done when their exit criteria pass.

## Milestone 0 - Foundations
- Monorepo (pnpm + Turborepo), TypeScript strict, Biome, CI, Docker Compose (Postgres, Valkey, Garage).
- Docs reviewed and agreed (this folder).
- **Exit:** `pnpm dev` starts web + api + deps; CI green on an empty app.

## Milestone 1 - Engine
- `@arcade/engine`: loop, input (keyboard/gamepad/touch), seeded RNG, renderer, audio, particles, recorder, headless runner.
- Reference game: **Pong** end-to-end through the real contract, with a replay test.
- **Exit:** Pong runs in browser and headless with identical results; 60 FPS; destroy leaves no listeners.

## Milestone 2 - Backend core (done, except OpenAPI + generated client; Postgres path untested)
- Auth, users, games catalog, sessions, scores (pending only), Postgres schema + migrations, seed 100 games.
- OpenAPI + generated client.
- **Exit:** register, play Pong, submit score, see it stored.

## Milestone 3 - Web shell (built; login, settings and score submission not yet checked in a browser)
- Catalog, game host with lazy loading, play page, settings (key remap, volume, reduced motion), login, mobile touch overlay.
- **Exit:** a player can find, play and pause a game on desktop and phone.

## Milestone 4 - Verified leaderboards
- Replay verifier worker, Valkey boards (all/weekly/daily), profile page, SSE status.
- **Exit:** tampered replay is rejected in an automated test; boards update only from verified scores.

## Milestone 5 - Archetype waves
Build the archetype, then ship its games (smallest first). Each wave ends with a content release.

| Wave | Archetype | Games (catalog #) | Count |
|---|---|---|---|
| 5.1 | PB paddle & ball | 83, 84, 85, 86, 97 | 5 |
| 5.2 | FB falling block | 88, 89, 90, 91, 94 | 5 |
| 5.3 | FS fixed shooter | 1, 2, 4, 9, 10, 11, 12, 18 | 8 |
| 5.4 | AR arena | 3, 16, 17, 19, 20, 23, 24, 39, 70, 72 | 10 |
| 5.5 | MZ maze chase | 21, 26, 27, 28, 29, 30, 31, 32, 34, 36, 37 | 11 |
| 5.6 | GP grid/lane puzzle | 38, 44, 92, 93, 95, 96, 98, 99, 100 | 9 |
| 5.7 | PF single-screen platformer | 33, 35, 40, 41, 42, 43, 45, 48, 49, 50, 55, 56, 57, 58 | 14 |
| 5.8 | SS scrolling shooter | 5, 6, 7, 8, 13, 14, 15, 25 | 8 |
| 5.9 | SC scrolling platformer | 22, 46, 47, 51, 52, 53, 54, 59, 67, 68, 79, 80 | 12 |
| 5.10 | RG + BU run-and-gun / beat-em-up | 60, 61, 62, 64, 65, 66, 69 | 7 |
| 5.11 | RT + R3 racers | 73, 74, 75, 76, 77, 78, 81, 82 | 8 |
| 5.12 | FT fighting | 63, 71, 87 | 3 |

Total 100. (Counts are checked against `catalog.json` in CI.)

Per-game pipeline: spec ([GAME_SPEC_TEMPLATE.md](GAME_SPEC_TEMPLATE.md)) -> implement -> determinism test -> replay test -> QA checklist ([TESTING.md](TESTING.md)) -> `live`.

## Milestone 6 - Polish and growth
- Achievements, daily challenges (fixed seed), favorites, share links, PWA/offline for solo play, CRT/shader themes, localization.
- Performance pass, accessibility audit, SEO for game pages.

## Later / out of scope for v1
- Real-time multiplayer and netplay.
- Level editors, user-generated content.
- Native wrappers.
- Monetization.

## Risks
| Risk | Mitigation |
|---|---|
| 100 games is a lot of content | Archetypes; ship waves, not all-at-once; S-size games first |
| Determinism bugs break replay verification | Lint ban on `Math.random`/`Date.now` in games; mandatory replay test per game |
| Trademark / copyright | Original art/audio/names; see [LEGAL.md](LEGAL.md) |
| Mobile performance | Budgets in [ARCHITECTURE.md](ARCHITECTURE.md), test on real devices |
| Cheating | Server-side replay verification; rate limits |
