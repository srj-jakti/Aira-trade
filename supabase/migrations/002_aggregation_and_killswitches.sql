-- =============================================
-- AIRA TRADING PLATFORM - DATABASE SCHEMA
-- Run this migration to create all required tables
-- =============================================

-- =============================================
-- SYSTEM FLAGS (Kill Switches)
-- =============================================
CREATE TABLE IF NOT EXISTS system_flags (
  flag_name TEXT PRIMARY KEY,
  flag_value BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT,
  reason TEXT
);

-- Insert default flags
INSERT INTO system_flags (flag_name, flag_value, updated_at, updated_by, reason) VALUES
  ('DISABLE_MARKET_DATA', false, NOW(), 'system', 'Initial setup'),
  ('DISABLE_SCANNER', false, NOW(), 'system', 'Initial setup'),
  ('DISABLE_TRADING', false, NOW(), 'system', 'Initial setup'),
  ('SAFE_MODE', false, NOW(), 'system', 'Initial setup'),
  ('MAINTENANCE_MODE', false, NOW(), 'system', 'Initial setup')
ON CONFLICT (flag_name) DO NOTHING;

-- =============================================
-- AGGREGATED CANDLES TABLES
-- =============================================

-- 1-second candles
CREATE TABLE IF NOT EXISTS aggregated_candles_1s (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instrument_token INTEGER NOT NULL,
  bucket_start TIMESTAMPTZ NOT NULL,
  open NUMERIC(18,4) NOT NULL,
  high NUMERIC(18,4) NOT NULL,
  low NUMERIC(18,4) NOT NULL,
  close NUMERIC(18,4) NOT NULL,
  volume BIGINT DEFAULT 0,
  oi BIGINT DEFAULT 0,
  tick_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(instrument_token, bucket_start)
);

-- 5-second candles
CREATE TABLE IF NOT EXISTS aggregated_candles_5s (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instrument_token INTEGER NOT NULL,
  bucket_start TIMESTAMPTZ NOT NULL,
  open NUMERIC(18,4) NOT NULL,
  high NUMERIC(18,4) NOT NULL,
  low NUMERIC(18,4) NOT NULL,
  close NUMERIC(18,4) NOT NULL,
  volume BIGINT DEFAULT 0,
  oi BIGINT DEFAULT 0,
  tick_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(instrument_token, bucket_start)
);

-- 15-second candles
CREATE TABLE IF NOT EXISTS aggregated_candles_15s (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instrument_token INTEGER NOT NULL,
  bucket_start TIMESTAMPTZ NOT NULL,
  open NUMERIC(18,4) NOT NULL,
  high NUMERIC(18,4) NOT NULL,
  low NUMERIC(18,4) NOT NULL,
  close NUMERIC(18,4) NOT NULL,
  volume BIGINT DEFAULT 0,
  oi BIGINT DEFAULT 0,
  tick_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(instrument_token, bucket_start)
);

-- Indexes for candles
CREATE INDEX IF NOT EXISTS idx_candles_1s_token_time ON aggregated_candles_1s(instrument_token, bucket_start DESC);
CREATE INDEX IF NOT EXISTS idx_candles_5s_token_time ON aggregated_candles_5s(instrument_token, bucket_start DESC);
CREATE INDEX IF NOT EXISTS idx_candles_15s_token_time ON aggregated_candles_15s(instrument_token, bucket_start DESC);

-- =============================================
-- INSTRUMENT INTEREST LOG (for dynamic subscriptions)
-- =============================================
CREATE TABLE IF NOT EXISTS instrument_interest_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instrument_token INTEGER NOT NULL,
  interest_type TEXT NOT NULL, -- search, chart, scanner, watchlist, position
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  weight INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interest_log_token ON instrument_interest_log(instrument_token);
CREATE INDEX IF NOT EXISTS idx_interest_log_created ON instrument_interest_log(created_at DESC);

-- =============================================
-- UPDATE INSTRUMENTS TABLE (add subscription fields)
-- =============================================
ALTER TABLE instruments 
  ADD COLUMN IF NOT EXISTS is_subscribed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS subscription_mode TEXT DEFAULT 'quote',
  ADD COLUMN IF NOT EXISTS subscription_priority TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_instruments_subscribed ON instruments(is_subscribed) WHERE is_subscribed = true;

-- =============================================
-- UPDATE ADMIN_ZERODHA_CONFIGS (add max_instruments)
-- =============================================
ALTER TABLE admin_zerodha_configs
  ADD COLUMN IF NOT EXISTS max_instruments INTEGER DEFAULT 3000;

-- =============================================
-- DATA ENGINE STATUS (update for multi-admin)
-- =============================================
CREATE TABLE IF NOT EXISTS data_engine_status (
  engine_type TEXT PRIMARY KEY,
  status TEXT DEFAULT 'stopped',
  websocket_status TEXT DEFAULT 'disconnected',
  zerodha_config_id UUID,
  subscribed_instruments INTEGER DEFAULT 0,
  ticks_per_second INTEGER DEFAULT 0,
  last_tick_at TIMESTAMPTZ,
  last_error TEXT,
  started_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- CLEANUP OLD DATA (scheduled job)
-- =============================================

-- Function to clean old tick data
CREATE OR REPLACE FUNCTION cleanup_old_ticks()
RETURNS void AS $$
BEGIN
  -- Delete raw ticks older than 1 hour
  DELETE FROM realtime_ticks WHERE tick_timestamp < NOW() - INTERVAL '1 hour';
  
  -- Delete 1s candles older than 1 day
  DELETE FROM aggregated_candles_1s WHERE bucket_start < NOW() - INTERVAL '1 day';
  
  -- Delete 5s candles older than 7 days
  DELETE FROM aggregated_candles_5s WHERE bucket_start < NOW() - INTERVAL '7 days';
  
  -- Delete 15s candles older than 30 days
  DELETE FROM aggregated_candles_15s WHERE bucket_start < NOW() - INTERVAL '30 days';
  
  -- Delete old interest logs older than 30 days
  DELETE FROM instrument_interest_log WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- ENABLE REALTIME
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE aggregated_candles_1s;
ALTER PUBLICATION supabase_realtime ADD TABLE aggregated_candles_5s;
ALTER PUBLICATION supabase_realtime ADD TABLE aggregated_candles_15s;
ALTER PUBLICATION supabase_realtime ADD TABLE system_flags;

-- =============================================
-- RLS POLICIES
-- =============================================

-- System flags: read-only for authenticated users
ALTER TABLE system_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read system flags"
  ON system_flags FOR SELECT
  TO authenticated
  USING (true);

-- Aggregated candles: read-only for authenticated users
ALTER TABLE aggregated_candles_1s ENABLE ROW LEVEL SECURITY;
ALTER TABLE aggregated_candles_5s ENABLE ROW LEVEL SECURITY;
ALTER TABLE aggregated_candles_15s ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read 1s candles"
  ON aggregated_candles_1s FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can read 5s candles"
  ON aggregated_candles_5s FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can read 15s candles"
  ON aggregated_candles_15s FOR SELECT
  TO authenticated
  USING (true);
