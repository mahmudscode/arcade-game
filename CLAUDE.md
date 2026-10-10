# CLAUDE.md

Guidance for AI coding sessions in this repo. Read [README.md](README.md) and the docs it links before changing anything.

## Project
Web app hosting 100 classic arcade-style games, with a backend for accounts, verified leaderboards and saves. Planned monorepo: `apps/web`, `apps/api`, `packages/{engine,archetypes,games,shared,db,ui}`. See [docs/TECH_STACK.md](docs/TECH_STACK.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

The old prototype was removed. The UI follows [docs/DESIGN.md](docs/DESIGN.md); keep it matching `docs/design/`.
Implemented so far: `apps/web` (catalog, player, login, settings, score submission), `apps/api` (auth, catalog, sessions, replay verifier, leaderboards, profiles), `packages/{engine,games,shared,db}`. Still planned: `packages/{archetypes,ui}`, Turborepo, Biome.

## Hard rules
1. Code inside `packages/games/**` and `packages/archetypes/**` must be deterministic: no `Math.random`, `Date.now`, `performance.now`, `window`, `document`. Use `ctx.rng` and `dt`.
2. Event listeners exist only in `packages/engine/input`. `destroy()` must clean up everything.
3. Validate all API input with Zod schemas from `packages/shared`. Never trust a client-submitted score; only `verified` scores reach leaderboards.
4. Original assets and names only; no copied sprites, audio or ROMs ([docs/LEGAL.md](docs/LEGAL.md)).
5. Write the game spec ([docs/GAME_SPEC_TEMPLATE.md](docs/GAME_SPEC_TEMPLATE.md)) before implementing a game, and the determinism/replay/invariant tests alongside it ([docs/TESTING.md](docs/TESTING.md)).
6. Free and open source only: no paid services, SaaS SDKs or non-OSI licenses (see licensing policy in [docs/TECH_STACK.md](docs/TECH_STACK.md)). Use Valkey, not Redis; self-hosted services only.
7. Game slugs are permanent kebab-case identifiers.
8. Prefer extending an archetype over copying logic between games.

## Workflow
- Build order follows [docs/ROADMAP.md](docs/ROADMAP.md): engine, backend core, web shell, verified leaderboards, then archetype waves.
- Update [docs/GAME_CATALOG.md](docs/GAME_CATALOG.md) status when a game changes stage.
- Conventional Commits; one game or concern per PR.
- Before finishing: `pnpm lint && pnpm typecheck && pnpm test`.

## Commands
```
pnpm dev | pnpm build | pnpm test | pnpm typecheck
```
