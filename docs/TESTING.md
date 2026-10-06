# Testing

| Level | Tool | What |
|---|---|---|
| Unit | Vitest | engine modules (RNG, collision, recorder), archetype helpers, API handlers |
| Property | fast-check | game invariants, e.g. score never decreases, lives never negative, no NaN positions |
| Determinism | Vitest + `headless` | same seed + same inputs -> byte-identical final state |
| Replay | Vitest | recorded replay re-simulated by the verifier gives the same score; mutated replay fails |
| API integration | Vitest + Testcontainers (Postgres, Valkey) | routes, auth, rate limits, leaderboards |
| E2E | Playwright | login, open a game, play a few frames, submit score, see leaderboard |
| Visual (optional) | Playwright screenshots | menu/HUD regressions |
| Performance | Playwright + trace | frame time budget on a throttled CPU |

## Required for every game (CI gate)
1. `determinism.test.ts`: run 3600 frames with a scripted input sequence twice -> equal state hash.
2. `replay.test.ts`: record, serialize, verify through the worker code path.
3. `invariants.test.ts`: fuzz random inputs for 10,000 frames; no exceptions, no NaN, score is a non-negative integer.
4. Bundle size check against budget.
5. Lint rule: no `Math.random`, `Date.now`, `performance.now`, `window`, `document` inside `packages/games/**` and `packages/archetypes/**`.

## Manual QA checklist per game
- [ ] First 60 seconds are understandable without instructions
- [ ] Pause/resume, tab switch, resize, orientation change
- [ ] Death, game over, restart cycle repeated 10 times (no leaked listeners/memory growth)
- [ ] Keyboard, gamepad, touch
- [ ] Audio on/off/volume
- [ ] Reduced motion
- [ ] Difficulty ramps; no unwinnable states

## Commands (once scaffolded)
```
pnpm test            # all unit tests
pnpm test:games      # determinism + replay + invariants for all games
pnpm test:e2e        # Playwright
pnpm typecheck && pnpm lint
```

## CI pipeline
lint -> typecheck -> unit -> game tests (matrix by archetype) -> API integration -> build -> e2e -> deploy preview. Main branch deploys to staging automatically; production is a manual promote.
