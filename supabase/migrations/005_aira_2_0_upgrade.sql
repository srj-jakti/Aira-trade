-- Upgrade Schema for AiRA 2.0 (Unified Timeframe Architecture)

-- 1. Enhance Strategies Table
ALTER TABLE strategies 
ADD COLUMN IF NOT EXISTS category text CHECK (category IN ('SCALPING', 'INTRADAY', 'SWING', 'INVESTMENT')),
ADD COLUMN IF NOT EXISTS asset_class_focus text[] DEFAULT '{}';

-- 2. User Risk Profiles (The "Sentry" Worker Source)
CREATE TABLE IF NOT EXISTS user_risk_profiles (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    total_capital numeric NOT NULL DEFAULT 0,
    daily_profit_target numeric,
    daily_loss_limit numeric NOT NULL DEFAULT 0,
    max_trades_per_day integer DEFAULT 10,
    preferred_segments text[] DEFAULT '{}', -- e.g. ['OPTIONS_BUY', 'EQUITY_INTRADAY']
    current_day_pnl numeric DEFAULT 0,
    kill_switch_active boolean DEFAULT false,
    updated_at timestamptz DEFAULT now()
);

-- 3. AI Predictions (The "Predictive Brain" Output)
CREATE TABLE IF NOT EXISTS ai_predictions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    instrument_token bigint NOT NULL,
    tradingsymbol text NOT NULL,
    timeframe text NOT NULL, -- '5m', '1h', etc.
    prediction_time timestamptz DEFAULT now(),
    forecast_horizon text NOT NULL, -- 'NEXT_HOUR', 'NEXT_DAY'
    
    -- Structured Prediction Data
    predicted_high numeric,
    predicted_low numeric,
    predicted_close numeric,
    predicted_path jsonb, -- Array of { time: string, price: number }
    
    -- AI Context
    confidence_score numeric CHECK (confidence_score BETWEEN 0 AND 100),
    regime_detected text, -- 'TRENDING_UP', 'CHOP', etc.
    model_version text,
    
    created_at timestamptz DEFAULT now()
);

-- Indexes for fast retrieval by Analysis Page
CREATE INDEX IF NOT EXISTS idx_ai_predictions_lookup 
ON ai_predictions(instrument_token, timeframe, prediction_time DESC);

-- 4. Market Segments (Optional Helper)
CREATE TYPE market_segment AS ENUM ('EQUITY', 'FUTURES', 'OPTIONS');
