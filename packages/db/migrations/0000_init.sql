CREATE TABLE users (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  username text NOT NULL,
  password_hash text,
  avatar text,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_uq ON users (lower(email));
CREATE UNIQUE INDEX users_username_uq ON users (lower(username));

CREATE TABLE auth_sessions (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_sessions_user_idx ON auth_sessions (user_id);

CREATE TABLE games (
  slug text PRIMARY KEY,
  title text NOT NULL,
  category text NOT NULL,
  archetype text,
  description text NOT NULL DEFAULT '',
  controls jsonb NOT NULL DEFAULT '[]',
  current_version integer NOT NULL DEFAULT 1,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE game_sessions (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  game_slug text NOT NULL REFERENCES games(slug),
  game_version integer NOT NULL,
  seed integer NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false
);

CREATE TABLE scores (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_slug text NOT NULL REFERENCES games(slug),
  game_version integer NOT NULL,
  session_id uuid NOT NULL UNIQUE REFERENCES game_sessions(id),
  score bigint NOT NULL,
  level_reached integer NOT NULL DEFAULT 0,
  duration_ms integer NOT NULL,
  replay_key text,
  replay bytea,
  idempotency_key text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  reject_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX scores_board_idx ON scores (game_slug, status, score DESC);
CREATE INDEX scores_user_idx ON scores (user_id, game_slug, created_at DESC);
CREATE UNIQUE INDEX scores_idem_uq ON scores (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
