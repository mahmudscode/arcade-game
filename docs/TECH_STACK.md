# Tech Stack

Decisions for building a web app that hosts **100 classic arcade games** with accounts, leaderboards and cloud saves. Each choice lists the reason and the main alternative rejected.

## Summary

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript** everywhere (strict) | One language for client, server and shared game logic; catches bugs across 100 games |
| Monorepo | **pnpm workspaces** + **Turborepo** (local cache only) | Shared packages, cached builds |
| Web app | **Vite + React 19 + React Router** | Fast dev, SPA shell for catalog/profile/leaderboards |
| Styling | **Tailwind CSS** + CSS variables for theming | Quick consistent UI, dark/neon theme tokens |
| Game runtime | **Custom thin engine on Canvas 2D** (`@arcade/engine`) | Tiny, no per-game framework overhead; games are small and archetype-driven |
| Audio | **Web Audio API** (procedural SFX, chiptune synth) | No asset downloads, retro sound |
| Backend | **Node 22 + Fastify** | Fast, schema-first, TypeScript friendly |
| Validation | **Zod** (shared between client and server) | One schema -> types + runtime validation |
| Database | **PostgreSQL 16** + **Drizzle ORM** | Relational data (users, scores, saves), typed migrations |
| Cache / leaderboards | **Valkey 8** (sorted sets), BullMQ for jobs | BSD-licensed Redis fork; O(log n) ranks, daily/weekly boards, rate limits |
| Object storage | **Garage** (or MinIO), S3-compatible | Replay blobs, self-hosted |
| Auth | **better-auth**, email + password, cookie sessions; OAuth optional | Avoids hand-rolled auth; works with no third-party account |
| API style | **REST + OpenAPI** (generated from Zod) | Simple, cacheable, typed client generated for the web app |
| Testing | **Vitest**, **Playwright**, **fast-check** | Unit, e2e, property tests for game rules |
| Lint/format | **Biome** | One fast tool |
| Infra | **Docker Engine / Podman + Compose** (dev), self-hosted VPS (prod) with **Caddy** reverse proxy + automatic TLS (Let's Encrypt); static assets served by Caddy/nginx | All open source; no managed service required |
| CI | **Forgejo Actions** or **Woodpecker CI** (self-hosted); GitHub Actions only as optional free tier on a public repo | Lint, typecheck, test, build, deploy |
| Observability | **pino** logs, **GlitchTip** (Sentry-compatible, self-hosted) for errors, optional Prometheus + Grafana | Basics from day one |
| Email (password reset) | **Postfix** or any SMTP relay; **Mailpit** in dev | No paid email API |
| Fonts / assets | Self-hosted OFL fonts (e.g. Press Start 2P, Inter); original or CC0 art/audio | No Google Fonts CDN, no licensed assets |

## Licensing policy: free and open source only

Every dependency, tool and service must be **free to use** and under an OSI-approved open-source license (MIT, Apache-2.0, BSD, ISC, PostgreSQL, MPL-2.0, AGPL-3.0 for services we only run, not link). No paid tiers, no usage-metered SaaS, no proprietary SDKs.

| Replaced | With | Reason |
|---|---|---|
| Redis 7.4+ | **Valkey** (BSD-3) | Redis moved to non-OSI source-available licenses |
| Sentry SaaS | **GlitchTip** (self-hosted) | Sentry is not OSI open source and SaaS is paid |
| Fly.io, Cloudflare, Neon, Upstash | **Self-hosted VPS + Docker + Caddy** | Managed services are paid or proprietary |
| Docker Desktop | **Docker Engine** or **Podman** | Docker Desktop is paid for larger orgs |
| Google Fonts CDN | Self-hosted OFL fonts | Privacy and no third-party dependency |
| Turborepo Remote Cache | Local cache (or self-hosted cache server) | Vercel remote cache is a paid service |
| Google/GitHub OAuth (required) | Optional only | Provider accounts are third-party; core login is email + password |

Notes
- The only unavoidable cost is **a server and a domain name**. Everything running on it is free software. For development, a laptop is enough. A static, no-backend mode (local scores only) can be hosted free on any static host such as GitHub Pages or Codeberg Pages.
- Dependency licenses are checked in CI with `license-checker` (MIT) or `pnpm licenses list`; the build fails on anything outside the allowlist.
- AGPL components (Garage, MinIO, Grafana) are run unmodified as separate services, not linked into our code, so they do not affect the license of this project. Pick the license for this repo (suggest MIT or AGPL-3.0) before first release.

## Key decisions

### 1. Custom Canvas 2D engine instead of Phaser / PixiJS / Unity WebGL
- Most classics are 2D, low-resolution, simple collision. A 5-10 KB engine is enough.
- 100 games means per-game bundle size matters; each game must lazy-load and stay in the tens of KB.
- Rejected: **Phaser** (great, but ~1 MB and its own conventions we would fight), **PixiJS** (rendering only, we need the game loop and input anyway). Revisit only if a game needs heavy effects (use WebGL post-processing as an opt-in engine plugin).

### 2. Games are **pure TypeScript modules** with a fixed contract
Every game implements the same `Game` interface (see [ARCHITECTURE.md](ARCHITECTURE.md)):
deterministic `update(state, input, dt)` + `render(ctx, state)`, seeded RNG, no DOM access, no `window` listeners. Benefits:
- Runs identically in the browser and in **Node for server-side score verification**.
- Easy unit testing and replay recording.
- Games lazy-load via dynamic `import()`.

### 3. Backend exists to provide
1. Accounts and profiles.
2. Per-game leaderboards (all-time, weekly, daily).
3. **Verified** scores (replay validation, see [BACKEND_API.md](BACKEND_API.md)).
4. Cloud saves / settings / favorites.
5. Achievements and play stats.
6. Game catalog metadata served from DB (so adding game #101 needs no frontend release for metadata).

Games themselves run **client-side**. The server never streams gameplay.

### 4. Postgres + Valkey, not a BaaS
Firebase/Supabase would be faster to start, but leaderboard queries, replay validation workers and rate limiting are easier to control with our own API. Postgres is the source of truth; Valkey holds derived leaderboard data and can be rebuilt from Postgres.

### 5. Deterministic replays for anti-cheat
Games use a seeded PRNG and fixed 60 Hz timestep. The client submits `{seed, inputLog, claimedScore}`; a server worker re-simulates the game headlessly and rejects mismatches. Requires every game to be deterministic, which is why the contract forbids `Math.random()` and `Date.now()` inside game logic.

## Repo layout

```
arcade/
├── apps/
│   ├── web/                 # Vite + React SPA
│   └── api/                 # Fastify server + workers
├── packages/
│   ├── engine/              # game loop, input, audio, renderer, RNG, particles
│   ├── archetypes/          # reusable bases: maze-chase, platformer, shooter ...
│   ├── games/               # 100 games, one folder each (lazy-loaded)
│   ├── shared/              # Zod schemas, types, constants
│   ├── db/                  # Drizzle schema + migrations
│   └── ui/                  # shared React components
├── docs/
├── docker-compose.yml
├── turbo.json
└── pnpm-workspace.yaml
```

## Version targets
Node 22 LTS, pnpm 9, TypeScript 5.x, React 19, Vite 6, PostgreSQL 16, Valkey 8. Browsers: last 2 versions of Chrome, Firefox, Safari, Edge; iOS Safari 16+.

## Open questions
- Which VPS provider and domain registrar (the only paid items; the software on it is all free).
- License for this repo itself (MIT vs AGPL-3.0).
- Whether guest play (no account) should be allowed to post scores (proposal: guests play, scores need login).
- Multiplayer: out of scope for v1 (see [ROADMAP.md](ROADMAP.md)).
