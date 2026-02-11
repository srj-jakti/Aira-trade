-- Migration: Add trading_preferences and active_trade_instruments tables
-- These are critical for strategy activation and trading engine integration

-- 1. Create trading_preferences table if it doesn't exist
CREATE TABLE IF NOT EXISTS trading_preferences (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    strategy_id text,
    strategy_type text DEFAULT 'INTRADAY',
    risk_per_trade numeric DEFAULT 2.0,
    max_daily_loss numeric DEFAULT 5000,
    daily_profit_limit numeric DEFAULT 10000,
    daily_loss_limit numeric DEFAULT 5000,
    daily_pnl_realized numeric DEFAULT 0,
    max_trades_per_day integer DEFAULT 10,
    paper_trading_enabled boolean DEFAULT true,
    auto_trading_enabled boolean DEFAULT false,
    execution_lock boolean DEFAULT false,
    evaluation_error text,
    priority_score numeric DEFAULT 50,
    next_evaluation_at timestamptz,
    daily_quota_hit_at timestamptz,
    daily_quota_reason text,
    risk_profile jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. Create active_trade_instruments table if it doesn't exist
CREATE TABLE IF NOT EXISTS active_trade_instruments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    instrument_token bigint NOT NULL,
    tradingsymbol text,
    source_type text NOT NULL, -- 'strategy', 'scanner', 'manual', 'ai'
    source_id text,
    is_active boolean DEFAULT true,
    priority integer DEFAULT 50,
    added_by uuid REFERENCES auth.users(id),
    added_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    metadata jsonb,
    UNIQUE(instrument_token, source_type, source_id)
);

-- 3. Enable RLS on both tables
ALTER TABLE trading_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_trade_instruments ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for trading_preferences
-- Users can view and update their own preferences
CREATE POLICY "Users can view own trading preferences" ON trading_preferences
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trading preferences" ON trading_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trading preferences" ON trading_preferences
    FOR UPDATE USING (auth.uid() = user_id);

-- Service role has full access
CREATE POLICY "Service role full access to trading_preferences" ON trading_preferences
    FOR ALL USING (true);

-- 5. RLS Policies for active_trade_instruments
-- Users can view instruments they added
CREATE POLICY "Users can view own instruments" ON active_trade_instruments
    FOR SELECT USING (auth.uid() = added_by OR added_by IS NULL);

CREATE POLICY "Users can insert instruments" ON active_trade_instruments
    FOR INSERT WITH CHECK (auth.uid() = added_by OR added_by IS NULL);

CREATE POLICY "Users can update own instruments" ON active_trade_instruments
    FOR UPDATE USING (auth.uid() = added_by OR added_by IS NULL);

CREATE POLICY "Users can delete own instruments" ON active_trade_instruments
    FOR DELETE USING (auth.uid() = added_by OR added_by IS NULL);

-- Service role has full access
CREATE POLICY "Service role full access to instruments" ON active_trade_instruments
    FOR ALL USING (true);

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_trading_preferences_user_id ON trading_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_trading_preferences_strategy_id ON trading_preferences(strategy_id);
CREATE INDEX IF NOT EXISTS idx_trading_preferences_auto_trading ON trading_preferences(auto_trading_enabled) WHERE auto_trading_enabled = true;

CREATE INDEX IF NOT EXISTS idx_active_instruments_token ON active_trade_instruments(instrument_token);
CREATE INDEX IF NOT EXISTS idx_active_instruments_source ON active_trade_instruments(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_active_instruments_active ON active_trade_instruments(is_active) WHERE is_active = true;

-- 7. Add updated_at trigger for trading_preferences
CREATE OR REPLACE FUNCTION update_trading_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trading_preferences_updated_at
    BEFORE UPDATE ON trading_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_trading_preferences_updated_at();

-- 8. Add updated_at trigger for active_trade_instruments
CREATE OR REPLACE FUNCTION update_active_instruments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER active_instruments_updated_at
    BEFORE UPDATE ON active_trade_instruments
    FOR EACH ROW
    EXECUTE FUNCTION update_active_instruments_updated_at();

-- 9. Add comment documentation
COMMENT ON TABLE trading_preferences IS 'User trading preferences and settings for automated trading engine';
COMMENT ON TABLE active_trade_instruments IS 'Instruments actively monitored by scanner and trading engine';
COMMENT ON COLUMN trading_preferences.strategy_id IS 'ID of the currently active strategy for this user';
COMMENT ON COLUMN active_trade_instruments.source_type IS 'Source that added this instrument: strategy, scanner, manual, ai';
