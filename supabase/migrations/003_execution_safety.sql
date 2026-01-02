-- ============================================================================
-- Migration: Execution Safety Fields (Phase 2)
-- Description: Adds execution locking, scheduling, and signal state fields
-- for background AI auto-trading engine
-- ============================================================================

-- Add execution safety columns to trading_preferences
ALTER TABLE trading_preferences 
  ADD COLUMN IF NOT EXISTS execution_lock BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS execution_started_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS next_evaluation_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS last_evaluation_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS evaluation_error TEXT NULL,
  ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS priority_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS strategy_id UUID NULL,
  ADD COLUMN IF NOT EXISTS strategy_type TEXT DEFAULT 'intraday';

-- Create index for efficient querying of active traders (with priority ordering)
CREATE INDEX IF NOT EXISTS idx_trading_active_users 
  ON trading_preferences(auto_trading_enabled, next_evaluation_at, execution_lock, priority_score DESC)
  WHERE auto_trading_enabled = TRUE;

-- Create index for stale lock detection
CREATE INDEX IF NOT EXISTS idx_execution_locks
  ON trading_preferences(execution_lock, execution_started_at)
  WHERE execution_lock = TRUE;

-- Add rate limiting table
CREATE TABLE IF NOT EXISTS user_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  minute_window TIMESTAMPTZ NOT NULL,
  order_count INTEGER DEFAULT 0,
  evaluation_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, minute_window)
);

-- Index for rate limit lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_window 
  ON user_rate_limits(user_id, minute_window);

-- Add signal_status column to ai_signals table for state machine tracking
-- MICRO-IMPROVEMENT #1: Signal State Machine
ALTER TABLE ai_signals 
  ADD COLUMN IF NOT EXISTS signal_status TEXT DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS status_reason TEXT NULL,
  ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS broker_order_id TEXT NULL;

-- Index for signal status queries
CREATE INDEX IF NOT EXISTS idx_signal_status 
  ON ai_signals(user_id, signal_status, created_at DESC);

-- Create user_positions table if not exists (for position monitoring)
CREATE TABLE IF NOT EXISTS user_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  instrument_token INTEGER NOT NULL,
  tradingsymbol TEXT NOT NULL,
  exchange TEXT DEFAULT 'NSE',
  quantity INTEGER NOT NULL,
  entry_price DECIMAL(15,4) NOT NULL,
  current_price DECIMAL(15,4),
  stop_loss DECIMAL(15,4),
  target_price DECIMAL(15,4),
  position_type TEXT DEFAULT 'LONG',
  status TEXT DEFAULT 'OPEN',
  unrealized_pnl DECIMAL(15,4) DEFAULT 0,
  unrealized_pnl_percent DECIMAL(10,4) DEFAULT 0,
  strategy_id UUID NULL,
  broker_order_id TEXT NULL,
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ NULL,
  exit_price DECIMAL(15,4) NULL,
  exit_reason TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for position queries
CREATE INDEX IF NOT EXISTS idx_user_positions_status ON user_positions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_positions_open ON user_positions(status) WHERE status = 'OPEN';

-- Create trading_engine_status table
CREATE TABLE IF NOT EXISTS trading_engine_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engine_type TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'stopped',
  last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
  active_users INTEGER DEFAULT 0,
  evaluations_last_minute INTEGER DEFAULT 0,
  orders_last_minute INTEGER DEFAULT 0,
  error_message TEXT NULL,
  started_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default trading engine status
INSERT INTO trading_engine_status (engine_type, status) 
VALUES ('trading_engine', 'stopped')
ON CONFLICT (engine_type) DO NOTHING;

-- Create system_flags table if not exists
CREATE TABLE IF NOT EXISTS system_flags (
  flag_name TEXT PRIMARY KEY,
  flag_value BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT NULL,
  reason TEXT NULL
);

-- Insert default flags
INSERT INTO system_flags (flag_name, flag_value) VALUES
  ('DISABLE_MARKET_DATA', FALSE),
  ('DISABLE_SCANNER', FALSE),
  ('DISABLE_TRADING', FALSE),
  ('SAFE_MODE', FALSE),
  ('MAINTENANCE_MODE', FALSE)
ON CONFLICT (flag_name) DO NOTHING;
