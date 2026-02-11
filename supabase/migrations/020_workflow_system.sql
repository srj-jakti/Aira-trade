-- Migration: Workflow System Foundation
-- Description: Visual workflow builder for strategy automation
-- Date: 2026-02-11

-- ============================================================================
-- 1. WORKFLOW DEFINITIONS
-- ============================================================================

CREATE TABLE strategy_workflows (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic info
  name TEXT NOT NULL,
  description TEXT,
  
  -- Workflow definition (JSON graph)
  nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
  edges JSONB NOT NULL DEFAULT '[]'::jsonb,
  start_node_id TEXT,
  
  -- Execution control
  is_active BOOLEAN DEFAULT false,
  is_draft BOOLEAN DEFAULT true,
  
  -- Schedule configuration
  schedule JSONB DEFAULT '{
    "enabled": false,
    "days": ["monday", "tuesday", "wednesday", "thursday", "friday"],
    "startTime": "09:15",
    "endTime": "15:30",
    "timezone": "Asia/Kolkata"
  }'::jsonb,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_executed_at TIMESTAMPTZ,
  
  -- Stats
  total_executions INTEGER DEFAULT 0,
  successful_executions INTEGER DEFAULT 0,
  failed_executions INTEGER DEFAULT 0,
  
  -- Version control
  version INTEGER DEFAULT 1,
  
  CONSTRAINT valid_workflow_name CHECK (char_length(name) >= 3 AND char_length(name) <= 100)
);

-- Indexes
CREATE INDEX idx_workflows_user_active ON strategy_workflows(user_id, is_active) WHERE is_active = true;
CREATE INDEX idx_workflows_user_draft ON strategy_workflows(user_id, is_draft);
CREATE INDEX idx_workflows_last_executed ON strategy_workflows(last_executed_at DESC NULLS LAST);

-- RLS Policies
ALTER TABLE strategy_workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workflows"
  ON strategy_workflows FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own workflows"
  ON strategy_workflows FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workflows"
  ON strategy_workflows FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own workflows"
  ON strategy_workflows FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 2. WORKFLOW EXECUTION HISTORY
-- ============================================================================

CREATE TABLE workflow_executions (
  id BIGSERIAL PRIMARY KEY,
  workflow_id BIGINT NOT NULL REFERENCES strategy_workflows(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Execution info
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'stopped', 'cancelled')),
  
  -- Execution trace
  execution_path JSONB DEFAULT '[]'::jsonb,
  node_outputs JSONB DEFAULT '{}'::jsonb,
  
  -- Results
  orders_placed INTEGER DEFAULT 0,
  signals_generated INTEGER DEFAULT 0,
  positions_opened INTEGER DEFAULT 0,
  positions_closed INTEGER DEFAULT 0,
  
  -- Error handling
  error_message TEXT,
  error_node_id TEXT,
  
  -- Performance
  execution_time_ms INTEGER,
  
  -- Context snapshot
  market_context JSONB,
  
  CONSTRAINT valid_execution_time CHECK (execution_time_ms >= 0)
);

-- Indexes
CREATE INDEX idx_executions_workflow ON workflow_executions(workflow_id, started_at DESC);
CREATE INDEX idx_executions_user ON workflow_executions(user_id, started_at DESC);
CREATE INDEX idx_executions_status ON workflow_executions(status, started_at DESC);

-- RLS Policies
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own executions"
  ON workflow_executions FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================================
-- 3. WORKFLOW TRIGGERS
-- ============================================================================

CREATE TABLE workflow_triggers (
  id BIGSERIAL PRIMARY KEY,
  workflow_id BIGINT NOT NULL REFERENCES strategy_workflows(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  
  -- Trigger type
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'range_breakout',
    'price_breakout',
    'webhook',
    'order_status',
    'wait_time',
    'portfolio_check',
    'symbol_details',
    'orderbook_check',
    'time_schedule'
  )),
  
  -- Configuration
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- State tracking
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  trigger_count INTEGER DEFAULT 0,
  
  -- Cooldown management
  cooldown_seconds INTEGER DEFAULT 0,
  next_eligible_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_cooldown CHECK (cooldown_seconds >= 0),
  CONSTRAINT unique_workflow_node UNIQUE (workflow_id, node_id)
);

-- Indexes
CREATE INDEX idx_triggers_workflow ON workflow_triggers(workflow_id, is_active);
CREATE INDEX idx_triggers_type ON workflow_triggers(trigger_type, is_active);
CREATE INDEX idx_triggers_eligible ON workflow_triggers(next_eligible_at) WHERE is_active = true;

-- ============================================================================
-- 4. WORKFLOW TEMPLATES
-- ============================================================================

CREATE TABLE workflow_templates (
  id BIGSERIAL PRIMARY KEY,
  
  -- Template info
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN (
    'intraday',
    'swing',
    'scalping',
    'options',
    'multi_leg',
    'risk_management'
  )),
  
  -- Template definition
  nodes JSONB NOT NULL,
  edges JSONB NOT NULL,
  start_node_id TEXT NOT NULL,
  
  -- Metadata
  is_public BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  
  -- Usage stats
  usage_count INTEGER DEFAULT 0,
  avg_win_rate DECIMAL(5,2),
  avg_profit_factor DECIMAL(5,2),
  
  -- Tags for discovery
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_template_name CHECK (char_length(name) >= 3)
);

-- Indexes
CREATE INDEX idx_templates_category ON workflow_templates(category, is_public);
CREATE INDEX idx_templates_usage ON workflow_templates(usage_count DESC);
CREATE INDEX idx_templates_tags ON workflow_templates USING GIN(tags);

-- RLS Policies
ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public templates are viewable by all"
  ON workflow_templates FOR SELECT
  USING (is_public = true OR auth.uid() = created_by);

-- ============================================================================
-- 5. SCANNER OPPORTUNITIES
-- ============================================================================

CREATE TABLE scanner_opportunities (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Instrument info
  instrument_token INTEGER NOT NULL,
  tradingsymbol TEXT NOT NULL,
  exchange TEXT NOT NULL,
  
  -- Trigger details
  trigger_type TEXT NOT NULL,
  trigger_details JSONB NOT NULL,
  
  -- Market data
  current_price DECIMAL(12,2) NOT NULL,
  volume BIGINT,
  spread DECIMAL(12,4),
  
  -- Suggested action
  suggested_action TEXT CHECK (suggested_action IN ('BUY', 'SELL')),
  suggested_entry DECIMAL(12,2),
  suggested_sl DECIMAL(12,2),
  suggested_target DECIMAL(12,2),
  risk_reward_ratio DECIMAL(5,2),
  
  -- Confidence
  confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
  reasoning TEXT,
  
  -- Workflow conversion
  can_automate BOOLEAN DEFAULT true,
  converted_to_workflow_id BIGINT REFERENCES strategy_workflows(id),
  
  -- Lifecycle
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'executed', 'ignored')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  
  CONSTRAINT valid_opportunity_prices CHECK (
    suggested_entry > 0 AND 
    suggested_sl > 0 AND 
    suggested_target > 0
  )
);

-- Indexes
CREATE INDEX idx_opportunities_user_active ON scanner_opportunities(user_id, status, created_at DESC) 
  WHERE status = 'active';
CREATE INDEX idx_opportunities_expires ON scanner_opportunities(expires_at) 
  WHERE status = 'active';
CREATE INDEX idx_opportunities_instrument ON scanner_opportunities(instrument_token, created_at DESC);

-- RLS Policies
ALTER TABLE scanner_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own opportunities"
  ON scanner_opportunities FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

-- ============================================================================
-- 6. WORKFLOW ANALYTICS
-- ============================================================================

CREATE TABLE workflow_analytics (
  id BIGSERIAL PRIMARY KEY,
  workflow_id BIGINT NOT NULL REFERENCES strategy_workflows(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Time period
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  
  -- Execution metrics
  total_executions INTEGER DEFAULT 0,
  successful_executions INTEGER DEFAULT 0,
  failed_executions INTEGER DEFAULT 0,
  avg_execution_time_ms INTEGER,
  
  -- Trading metrics
  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  losing_trades INTEGER DEFAULT 0,
  total_pnl DECIMAL(12,2) DEFAULT 0,
  
  -- Performance metrics
  win_rate DECIMAL(5,2),
  profit_factor DECIMAL(5,2),
  avg_profit DECIMAL(12,2),
  avg_loss DECIMAL(12,2),
  max_drawdown DECIMAL(12,2),
  sharpe_ratio DECIMAL(5,2),
  
  -- Node performance
  node_success_rates JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_period CHECK (period_end > period_start)
);

-- Indexes
CREATE INDEX idx_analytics_workflow ON workflow_analytics(workflow_id, period_start DESC);
CREATE INDEX idx_analytics_user ON workflow_analytics(user_id, period_start DESC);

-- RLS Policies
ALTER TABLE workflow_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own analytics"
  ON workflow_analytics FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================================
-- 7. HELPER FUNCTIONS
-- ============================================================================

-- Function to update workflow stats after execution
CREATE OR REPLACE FUNCTION update_workflow_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' THEN
    UPDATE strategy_workflows
    SET 
      total_executions = total_executions + 1,
      successful_executions = successful_executions + 1,
      last_executed_at = NEW.completed_at,
      updated_at = NOW()
    WHERE id = NEW.workflow_id;
  ELSIF NEW.status = 'failed' THEN
    UPDATE strategy_workflows
    SET 
      total_executions = total_executions + 1,
      failed_executions = failed_executions + 1,
      last_executed_at = NEW.completed_at,
      updated_at = NOW()
    WHERE id = NEW.workflow_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_workflow_stats
  AFTER UPDATE OF status ON workflow_executions
  FOR EACH ROW
  WHEN (NEW.status IN ('completed', 'failed') AND OLD.status = 'running')
  EXECUTE FUNCTION update_workflow_stats();

-- Function to expire old scanner opportunities
CREATE OR REPLACE FUNCTION expire_old_opportunities()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE scanner_opportunities
  SET status = 'expired'
  WHERE status = 'active' 
    AND expires_at < NOW();
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate workflow analytics
CREATE OR REPLACE FUNCTION calculate_workflow_analytics(
  p_workflow_id BIGINT,
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ
)
RETURNS TABLE (
  total_executions INTEGER,
  successful_executions INTEGER,
  win_rate DECIMAL,
  total_pnl DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_executions,
    COUNT(*) FILTER (WHERE status = 'completed')::INTEGER as successful_executions,
    ROUND(
      (COUNT(*) FILTER (WHERE status = 'completed')::DECIMAL / NULLIF(COUNT(*), 0)) * 100,
      2
    ) as win_rate,
    COALESCE(SUM(
      (node_outputs->>'total_pnl')::DECIMAL
    ), 0) as total_pnl
  FROM workflow_executions
  WHERE workflow_id = p_workflow_id
    AND started_at >= p_period_start
    AND started_at <= p_period_end;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. INITIAL DATA
-- ============================================================================

-- Insert default workflow templates
INSERT INTO workflow_templates (name, description, category, nodes, edges, start_node_id, is_public, tags) VALUES
(
  'Simple Breakout Strategy',
  'Buy on range breakout with fixed stop loss and target',
  'intraday',
  '[
    {
      "id": "trigger_1",
      "type": "trigger",
      "triggerType": "range_breakout",
      "config": {
        "symbol": "NIFTY",
        "timeRange": {"start": "09:30", "end": "10:00"},
        "direction": "upside"
      }
    },
    {
      "id": "action_1",
      "type": "action",
      "actionType": "place_order",
      "config": {
        "orderType": "MARKET",
        "quantity": 50,
        "stopLoss": {"type": "percentage", "value": 1},
        "target": {"type": "percentage", "value": 2}
      }
    }
  ]'::jsonb,
  '[{"from": "trigger_1", "to": "action_1"}]'::jsonb,
  'trigger_1',
  true,
  ARRAY['breakout', 'intraday', 'beginner']
),
(
  'Bull Put Spread',
  'Options spread strategy for bullish markets',
  'options',
  '[
    {
      "id": "trigger_1",
      "type": "trigger",
      "triggerType": "range_breakout",
      "config": {
        "symbol": "NIFTY",
        "direction": "upside"
      }
    },
    {
      "id": "action_1",
      "type": "action",
      "actionType": "place_options_order",
      "config": {
        "underlying": "NIFTY",
        "optionType": "PE",
        "strikeSelection": {"type": "OTM", "offset": 4},
        "side": "BUY"
      }
    },
    {
      "id": "action_2",
      "type": "action",
      "actionType": "place_options_order",
      "config": {
        "underlying": "NIFTY",
        "optionType": "PE",
        "strikeSelection": {"type": "OTM", "offset": 1},
        "side": "SELL"
      }
    }
  ]'::jsonb,
  '[
    {"from": "trigger_1", "to": "action_1"},
    {"from": "action_1", "to": "action_2", "condition": "executed"}
  ]'::jsonb,
  'trigger_1',
  true,
  ARRAY['options', 'spread', 'bullish', 'advanced']
);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

COMMENT ON TABLE strategy_workflows IS 'Visual workflow definitions for strategy automation';
COMMENT ON TABLE workflow_executions IS 'Execution history and traces for workflows';
COMMENT ON TABLE workflow_triggers IS 'Trigger configurations and state tracking';
COMMENT ON TABLE workflow_templates IS 'Pre-built workflow templates for users';
COMMENT ON TABLE scanner_opportunities IS 'Market opportunities detected by scanner';
COMMENT ON TABLE workflow_analytics IS 'Performance analytics for workflows';
