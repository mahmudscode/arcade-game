# Backend API

Base path: `/api/v1`. JSON over HTTPS. Auth by session cookie. Schemas live in `packages/shared` (Zod) and the OpenAPI document is served at `/api/v1/openapi.json`.

Conventions
- Errors: `{ "error": { "code": "string", "message": "string", "details"?: any } }` with proper HTTP status.
- Pagination: `?limit=` (default 50, max 100) and `?cursor=`; responses `{ items, nextCursor }`.
- Timestamps: ISO 8601 UTC. IDs: UUIDv7 for rows, kebab-case slug for games.
- Idempotency: `POST /scores` accepts an `Idempotency-Key` header.

## Auth
| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | email + password + username |
| POST | `/auth/login` | sets session cookie |
| POST | `/auth/logout` | clears session |
| GET | `/auth/oauth/:provider` | optional, only if an operator configures a provider |
| GET | `/me` | current user (or 401) |
| PATCH | `/me` | update username, avatar, preferences |

## Catalog
| Method | Path | Description |
|---|---|---|
| GET | `/games` | list; filters `category`, `archetype`, `q`, `sort=popular\|new\|name` |
| GET | `/games/:slug` | metadata, controls, current version, stats |
| GET | `/games/:slug/stats` | plays, unique players, top score |

## Play sessions and scores
| Method | Path | Description |
|---|---|---|
| POST | `/sessions` | body `{gameSlug}` -> `{sessionId, seed, gameVersion, expiresAt}` |
| POST | `/scores` | body `{sessionId, score, replay (base64), durationMs}` -> `202 {scoreId, status:"pending"}` |
| GET | `/scores/:id` | status `pending\|verified\|rejected` |
| GET | `/scores/:id/events` | SSE stream for status change |
| GET | `/me/scores?game=` | my scores |

Rules
- A session is single-use, expires after 4 hours, and can be submitted once.
- `durationMs` must be consistent with replay frame count (frames / 60 +/- tolerance).
- Guests may create sessions but `POST /scores` needs auth.

## Leaderboards
| Method | Path | Description |
|---|---|---|
| GET | `/leaderboards/:slug?period=all\|weekly\|daily` | top N verified scores |
| GET | `/leaderboards/:slug/me?period=` | my rank + neighbors |
| GET | `/leaderboards/global` | cross-game points ranking |

Backed by Valkey sorted sets `lb:{slug}:{period}:{periodKey}`; rebuilt from Postgres by a job when needed. Best score per user per period.

## Saves and settings
| Method | Path | Description |
|---|---|---|
| GET/PUT | `/me/settings` | key bindings, volume, theme, accessibility |
| GET/PUT/DELETE | `/me/saves/:slug` | optional per-game save blob (<= 64 KB), for games with progression |
| GET/PUT/DELETE | `/me/favorites/:slug` | favorites |

## Achievements and stats
| Method | Path | Description |
|---|---|---|
| GET | `/achievements` | definitions |
| GET | `/users/:username` | public profile: stats, achievements, top scores |
| GET | `/me/stats` | play time, plays per game |

Achievements are evaluated by the verifier worker from verified replays (e.g. "clear level 5 without dying").

## Admin (role `admin`)
`POST/PATCH /admin/games`, `POST /admin/scores/:id/reject`, `POST /admin/leaderboards/:slug/rebuild`, `GET /admin/queue`.

## Rate limits (defaults)
| Route group | Limit |
|---|---|
| auth | 10 / min / IP |
| `POST /sessions` | 30 / min / user |
| `POST /scores` | 10 / min / user |
| reads | 120 / min / IP |

## Worker jobs (BullMQ)
- `verify-score`: replay headlessly with the pinned game version; timeout 10 s; 3 retries on infra errors only.
- `rollover-leaderboards`: daily/weekly archive at 00:00 UTC.
- `rebuild-leaderboard`: from Postgres.
- `evaluate-achievements`.

## Environment variables
```
DATABASE_URL=postgres://...
VALKEY_URL=redis://...
SESSION_SECRET=
# OAuth is optional; email+password works with no third party
PUBLIC_WEB_URL=
GLITCHTIP_DSN=   # optional, self-hosted
```
