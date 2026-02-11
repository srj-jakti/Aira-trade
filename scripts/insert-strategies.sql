-- Insert 20 Admin Strategies
-- 5 Scalping, 5 Intraday, 5 Swing, 5 Investment

-- SCALPING STRATEGIES (5)
INSERT INTO strategies (
  user_id, name, description, type, category,
  executable_strategy, selected_timeframes, selected_instruments,
  is_finalized, admin_approved, visibility
) VALUES
(
  '6a01d9d0-d331-410b-a514-27b2c01cb211',
  'Momentum Scalper Pro',
  'Quick entries on strong momentum with tight stops. Targets 0.3-0.5% moves in 1-5 minutes. Uses RSI and VWAP for confirmation.',
  'custom',
  'SCALPING',
  '{"name":"Momentum Scalper Pro","description":"Quick momentum scalping strategy","version":1,"strategyType":"INTRADAY","buy":{"logic":"AND","rules":[{"type":"indicator","name":"RSI","period":14,"operator":">","value":55},{"type":"price_vs_indicator","priceField":"close","operator":">","indicator":"VWAP"},{"type":"indicator","name":"RSI","period":14,"operator":"<","value":70}]},"sell":{"logic":"AND","rules":[{"type":"indicator","name":"RSI","period":14,"operator":"<","value":45},{"type":"price_vs_indicator","priceField":"close","operator":"<","indicator":"VWAP"},{"type":"indicator","name":"RSI","period":14,"operator":">","value":30}]},"buyExit":{"stopLoss":{"type":"PERCENTAGE","value":0.3},"target":{"type":"PERCENTAGE","value":0.5},"trailingSL":{"enabled":true,"activationPercent":0.3,"trailPercent":0.15}},"sellExit":{"stopLoss":{"type":"PERCENTAGE","value":0.3},"target":{"type":"PERCENTAGE","value":0.5},"trailingSL":{"enabled":true,"activationPercent":0.3,"trailPercent":0.15}},"requiredIndicators":[{"name":"RSI","period":14},{"name":"VWAP"}],"minWarmupCandles":20}'::jsonb,
  ARRAY['1m', '3m'],
  ARRAY[256265, 260105],
  true,
  true,
  'public'
);
