CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text,
  google_id text UNIQUE,
  display_name text NOT NULL,
  goal text,
  language text NOT NULL DEFAULT 'python',
  placement_skill_id text,
  onboarding_complete boolean NOT NULL DEFAULT false,
  daily_goal_xp integer NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_stats (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  xp integer NOT NULL DEFAULT 0,
  streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_active_on date,
  freezes integer NOT NULL DEFAULT 0,
  hearts integer NOT NULL DEFAULT 5,
  hearts_updated_at timestamptz NOT NULL DEFAULT now(),
  league_tier text NOT NULL DEFAULT 'bronze',
  contest_language text NOT NULL DEFAULT 'python'
);

CREATE TABLE IF NOT EXISTS xp_events (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  source text NOT NULL,
  lesson_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS xp_events_user_created ON xp_events (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS lesson_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id text NOT NULL,
  state jsonb NOT NULL,
  hearts_lost integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS lesson_sessions_user ON lesson_sessions (user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS lesson_completions (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id text NOT NULL,
  attempts integer NOT NULL DEFAULT 1,
  accuracy real NOT NULL DEFAULT 0,
  xp_awarded integer NOT NULL DEFAULT 0,
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS challenge_reviews (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_id text NOT NULL,
  lesson_id text NOT NULL,
  wrong_count integer NOT NULL DEFAULT 1,
  due_on date NOT NULL,
  cleared boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, challenge_id)
);
CREATE INDEX IF NOT EXISTS challenge_reviews_due ON challenge_reviews (user_id, due_on) WHERE cleared = false;

CREATE TABLE IF NOT EXISTS topic_mastery (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_id text NOT NULL,
  correct integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, topic_id)
);

CREATE TABLE IF NOT EXISTS problem_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  problem_id text NOT NULL,
  contest_id text,
  language text NOT NULL,
  source text NOT NULL,
  passed integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  score integer NOT NULL DEFAULT 0,
  status text NOT NULL,
  detail jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS problem_submissions_user ON problem_submissions (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS problem_progress (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  problem_id text NOT NULL,
  attempts integer NOT NULL DEFAULT 1,
  solved boolean NOT NULL DEFAULT false,
  first_solved_at timestamptz,
  PRIMARY KEY (user_id, problem_id)
);

CREATE TABLE IF NOT EXISTS contest_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contest_id text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  score integer NOT NULL DEFAULT 0,
  problem_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (user_id, contest_id)
);

CREATE TABLE IF NOT EXISTS user_badges (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id text NOT NULL,
  earned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, badge_id)
);

CREATE TABLE IF NOT EXISTS friend_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  problem_id text NOT NULL,
  creator_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joiner_id uuid REFERENCES users(id) ON DELETE SET NULL,
  creator_score integer,
  joiner_score integer,
  winner_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
