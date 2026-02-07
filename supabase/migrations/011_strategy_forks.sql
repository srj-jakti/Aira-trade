CREATE TABLE IF NOT EXISTS strategy_forks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_strategy_id BIGINT NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fork_strategy_id BIGINT NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (source_strategy_id, user_id)
);

CREATE INDEX IF NOT EXISTS strategy_forks_by_user_id ON strategy_forks(user_id);
CREATE INDEX IF NOT EXISTS strategy_forks_by_fork_strategy_id ON strategy_forks(fork_strategy_id);

