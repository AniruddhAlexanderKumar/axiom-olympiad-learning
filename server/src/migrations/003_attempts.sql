CREATE TABLE IF NOT EXISTS challenge_attempts (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_id text NOT NULL,
  lesson_id text NOT NULL,
  correct boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS challenge_attempts_user ON challenge_attempts (user_id, created_at DESC);
