-- Live-Historical Data Engine Migration
-- Adds performance indexes for live_candles table
-- Supports the new Live-Historical data layer for charts, AI, scanner, and auto-trading

-- Performance index for live_candles lookup
-- This is the primary query pattern: instrument_token + timeframe + timestamp DESC
CREATE INDEX IF NOT EXISTS idx_live_candles_lookup 
ON live_candles(instrument_token, timeframe, timestamp DESC);

-- Index for cleanup operations (removing old data based on timestamp)
CREATE INDEX IF NOT EXISTS idx_live_candles_cleanup
ON live_candles(timeframe, timestamp);

-- Index for realtime subscription filtering
CREATE INDEX IF NOT EXISTS idx_live_candles_instrument
ON live_candles(instrument_token);

-- Comment documenting the data model
COMMENT ON TABLE live_candles IS 
'Live-Historical candles for charts, AI analysis, scanner, and auto-trading. 
Contains rolling recent history (hours to days based on timeframe).
NEVER use for backtesting - use historical_candles instead.
Populated by: WebSocket aggregation + Zerodha Historical API backfill.';

COMMENT ON TABLE historical_candles IS 
'Admin-saved historical candles for backtesting ONLY.
Contains long-term history (months to years).
NEVER use for live features - use live_candles instead.
Populated by: Admin manual download after market close.';

-- Add index to historical_candles if not exists (for backtest performance)
CREATE INDEX IF NOT EXISTS idx_historical_candles_lookup
ON historical_candles(instrument_token, timeframe, timestamp);
