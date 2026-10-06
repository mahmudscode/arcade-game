# Architecture

## System overview

```
 Browser (apps/web)                              Server (apps/api)
┌──────────────────────────┐   REST/JSON    ┌──────────────────────────┐
│ React shell              │ ─────────────▶ │ Fastify routes           │
│  catalog, profile, boards│                │  auth, scores, saves ... │
│                          │                └───────┬───────────┬──────┘
│ Game host (iframe-less)  │                        │           │
│  └─ lazy import(game)    │                  ┌─────▼────┐ ┌────▼─────┐
│     └─ @arcade/engine    │                  │ Postgres │ │  Valkey   │
│        loop/input/audio  │                  └─────▲────┘ └────▲─────┘
└──────────────────────────┘                        │           │
                                              ┌─────┴───────────┴─────┐
                                              │ Replay verifier worker│
                                              │ (runs games headless) │
                                              └───────────────────────┘
```

## The Game contract (`packages/engine`)

Every game is a pure, deterministic module. No DOM, no globals, no `Math.random`, no `Date.now`.

```ts
export interface GameDefinition<S, I = StandardInput> {
  id: string;                       // 'pac-man' (kebab-case, stable forever)
  size: { width: number; height: number };   // logical resolution
  init(ctx: InitContext): S;        // ctx.rng is the seeded PRNG
  update(state: S, input: I, dt: number, ctx: UpdateContext): S | void;  // fixed dt = 1/60
  render(state: S, r: Renderer, alpha: number): void;   // pure drawing
  audio?(events: GameEvent[], a: AudioBus): void;
  status(state: S): { score: number; lives: number; level: number; over: boolean };
}
```

- **StandardInput**: `{ up, down, left, right, a, b, start }` plus pressed/released edges. Games needing more (e.g. mouse for Missile Command) declare an `inputProfile`.
- **Events**: `update` emits `GameEvent`s (`'explosion'`, `'pickup'`, ...). Audio and particles subscribe; game logic never plays sound directly.
- **Fixed timestep**: engine accumulates real time and calls `update` at 60 Hz; `render` receives an interpolation `alpha`.

### Engine modules
| Module | Responsibility |
|---|---|
| `loop` | rAF loop, fixed timestep, pause on tab blur |
| `input` | keyboard, gamepad, touch (virtual pad) -> `StandardInput`; the **only** place with event listeners |
| `rng` | seeded PRNG (mulberry32 / sfc32) |
| `renderer` | Canvas 2D wrapper: sprites, text, glow, screen shake, integer scaling, DPR handling |
| `audio` | Web Audio synth: square/noise SFX presets, simple music sequencer |
| `fx` | particle system, trails, post effects (CRT scanlines optional) |
| `recorder` | records input per frame -> compact replay (RLE) |
| `headless` | runs `update` without render for tests and server verification |

### Lifecycle
`mount(canvas, game, {seed, mode})` -> `GameSession` with `start/pause/resume/restart/destroy`. `destroy()` must remove **all** listeners and cancel rAF (no leaks when switching games).

## Archetypes (`packages/archetypes`)
100 games will not be 100 bespoke engines. Games are built on ~14 reusable archetypes configured with data (levels, sprites, enemy tables, speeds):

| Code | Archetype | Examples |
|---|---|---|
| FS | Fixed-screen shooter | Space Invaders, Galaga |
| SS | Scrolling shooter | 1942, R-Type |
| AR | Arena / free-movement | Asteroids, Robotron |
| MZ | Maze chase | Pac-Man, Dig Dug |
| PF | Single-screen platformer | Donkey Kong, Mario Bros. |
| SC | Scrolling platformer | Pitfall!, Ghosts 'n Goblins |
| RG | Run-and-gun | Contra, Commando |
| BU | Beat-'em-up | Double Dragon, Final Fight |
| FT | One-on-one fighting | Street Fighter II |
| R3 | Pseudo-3D racer | Out Run, Pole Position |
| RT | Top-down racer | Super Sprint |
| PB | Paddle & ball | Pong, Breakout |
| FB | Falling-block puzzle | Tetris, Columns |
| GP | Grid / lane puzzle | Q*bert, Sokoban, Frogger |

An archetype provides: entity system, tilemap/collision helpers, AI behavior primitives, scoring/lives rules. A game package supplies config + sprites + unique rules. Target: **a new game in an existing archetype = 1-3 days**, not 2 weeks.

## Frontend (`apps/web`)
- Routes: `/` catalog (search, category filter, favorites), `/play/:gameId`, `/leaderboard/:gameId`, `/profile/:user`, `/settings`, `/login`.
- Game host component: loads the game via `import(`@arcade/games/${id}`)` using a manifest map (explicit, so bundler can code-split; no dynamic string paths at runtime).
- State: **TanStack Query** for server data, **Zustand** for UI state. No global state for game internals.
- Responsive: canvas scales by integer factors when possible; touch controls overlay on mobile; keyboard remapping in settings.
- Accessibility: all menus keyboard-operable, reduced-motion setting disables screen shake/flash, colorblind-safe palettes where a game relies on color.

## Backend (`apps/api`)
- Fastify plugins per domain: `auth`, `games`, `scores`, `leaderboards`, `saves`, `achievements`, `users`.
- Zod schemas in `packages/shared` give request/response types, validation and OpenAPI docs.
- Background jobs (BullMQ on Valkey): replay verification, leaderboard rebuild, daily/weekly rollovers.
- See [BACKEND_API.md](BACKEND_API.md) and [DATABASE.md](DATABASE.md).

## Score submission flow
1. Client plays with `seed` obtained from `POST /api/sessions` (server-issued, single use, includes `gameId`, `startedAt`).
2. On game over, client sends `POST /api/scores` with `{sessionId, score, replay}`.
3. API validates shape/size/rate limits, stores a `pending` score, enqueues verification.
4. Worker loads the same game version, replays inputs headlessly, compares score. Match -> `verified` + Valkey update; mismatch -> `rejected`.
5. Client polls/subscribes (SSE) for the result; UI shows the score immediately as "pending verification".

Games are versioned (`gameVersion`); a replay is only valid against the version it was recorded on, so old versions stay in the worker bundle until their replays expire.

## Performance budgets
- Shell JS (initial): < 200 KB gzip.
- Each game chunk: < 150 KB gzip, excluding shared engine.
- Sustained 60 FPS on a mid-range phone; frame budget 8 ms update+render.
- Zero allocations in hot loops where practical (object pools for bullets/particles).

## Security
- HttpOnly + SameSite=Lax session cookies, CSRF token on mutating routes.
- Rate limiting per IP and per user (Valkey).
- Replay size cap (e.g. 256 KB) and verification time cap.
- Never trust client score; leaderboards show verified only.
- Strict CSP; no third-party scripts in the game page.
