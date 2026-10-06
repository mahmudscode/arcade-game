# Database

PostgreSQL 16, managed with Drizzle migrations in `packages/db`. Valkey holds derived data only.

## Tables

### users
| column | type | notes |
|---|---|---|
| id | uuid pk | UUIDv7 |
| email | citext unique | |
| username | citext unique | 3-20 chars |
| password_hash | text null | null for OAuth-only |
| avatar | text null | |
| role | text | `user` \| `admin` |
| created_at | timestamptz | |

### oauth_accounts
`id, user_id fk, provider, provider_user_id, created_at` - unique `(provider, provider_user_id)`.

### auth_sessions
`id, user_id fk, expires_at, ip, user_agent, created_at`.

### games
| column | type | notes |
|---|---|---|
| slug | text pk | `pac-man` |
| title | text | public name (may be an homage rename, see LEGAL.md) |
| category | text | shooter, maze, platformer, action, racing-sports, puzzle |
| archetype | text | FS, MZ, ... |
| description | text | |
| controls | jsonb | for the help overlay |
| current_version | int | bumps when rules change |
| enabled | bool | |
| created_at | timestamptz | |

### game_sessions
`id uuid pk, user_id fk null, game_slug fk, game_version int, seed bigint, started_at, expires_at, used bool`.

### scores
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| user_id | fk | |
| game_slug | fk | |
| game_version | int | |
| session_id | fk unique | one score per session |
| score | bigint | |
| level_reached | int | |
| duration_ms | int | |
| replay_key | text | object storage key (or bytea if small) |
| status | text | `pending` \| `verified` \| `rejected` |
| reject_reason | text null | |
| created_at | timestamptz | |

Indexes: `(game_slug, status, score desc)`, `(user_id, game_slug, created_at desc)`.

### user_settings
`user_id pk fk, key_bindings jsonb, volume jsonb, theme text, reduced_motion bool, updated_at`.

### saves
`user_id, game_slug, data jsonb (<=64KB), updated_at` - pk `(user_id, game_slug)`.

### favorites
`user_id, game_slug, created_at` - pk `(user_id, game_slug)`.

### achievements / user_achievements
`achievements(id, game_slug null, name, description, rule jsonb)`; `user_achievements(user_id, achievement_id, unlocked_at, score_id)`.

### play_stats
`user_id, game_slug, plays int, total_ms bigint, best_score bigint` - pk `(user_id, game_slug)`; updated by the verifier.

## Valkey keys
| key | type | content |
|---|---|---|
| `lb:{slug}:all` | zset | member userId, score best |
| `lb:{slug}:w:{isoWeek}` | zset | weekly |
| `lb:{slug}:d:{yyyymmdd}` | zset | daily |
| `rl:{route}:{id}` | counter | rate limits |
| BullMQ queues | | `verify-score`, `rollover`, `achievements` |

## Rules
- Only `verified` scores enter leaderboards.
- Replay blobs go to S3-compatible storage (Garage or MinIO, both self-hosted); rows keep only the key. Purge after 90 days unless the score is in a top-100.
- All migrations are forward-only and reviewed; no manual prod edits.
- Seed script inserts the 100 `games` rows from [GAME_CATALOG.md](GAME_CATALOG.md) data (`packages/games/catalog.json` is the machine-readable source).
