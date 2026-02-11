/**
 * Workflow System Type Definitions
 * Visual strategy builder types inspired by Fyers Automate
 */

// ============================================================================
// CORE NODE TYPES
// ============================================================================

export type NodeType = 'trigger' | 'action' | 'condition';

export interface BaseNode {
  id: string;
  type: NodeType;
  position?: { x: number; y: number };
  data?: Record<string, unknown>;
}

// ============================================================================
// TRIGGER NODES
// ============================================================================

export type TriggerType =
  | 'range_breakout'
  | 'price_breakout'
  | 'webhook'
  | 'order_status'
  | 'wait_time'
  | 'portfolio_check'
  | 'symbol_details'
  | 'orderbook_check'
  | 'time_schedule';

export interface TriggerNode extends BaseNode {
  type: 'trigger';
  triggerType: TriggerType;
  config: TriggerConfig;
  nextNodes: string[];
}

// Trigger Configurations

export interface RangeBreakoutConfig {
  symbol: string;
  timeRange: {
    start: string; // HH:MM format
    end: string;
  };
  direction: 'upside' | 'downside' | 'both';
  confirmationCandles?: number;
  timeframe?: string;
}

export interface PriceBreakoutConfig {
  symbol: string;
  level: number;
  direction: 'above' | 'below';
  confirmationType?: 'immediate' | 'candle_close';
  timeframe?: string;
}

export interface WebhookConfig {
  webhookUrl: string;
  secret?: string;
  expectedPayload?: Record<string, unknown>;
}

export interface OrderStatusConfig {
  orderId?: string;
  status: 'executed' | 'rejected' | 'pending' | 'cancelled';
  waitForAny?: boolean; // Wait for any order vs specific order
}

export interface WaitTimeConfig {
  durationType: 'duration' | 'until_time';
  duration?: number; // seconds
  untilTime?: string; // HH:MM format
}

export interface PortfolioCheckConfig {
  checkType: 'pnl' | 'positions' | 'holdings_pnl' | 'intraday_pnl';
  operator: '>' | '<' | '>=' | '<=' | '==';
  value: number;
}

export interface SymbolDetailsConfig {
  symbol: string;
  checkType: '52w_high' | '52w_low' | 'circuit_upper' | 'circuit_lower' | 'day_high' | 'day_low' | 'bid_ask_spread' | 'volume';
  operator: '>' | '<' | '>=' | '<=' | '==';
  value: number;
}

export interface OrderbookCheckConfig {
  checkType: 'executed_orders' | 'pending_orders' | 'rejected_orders';
  operator: '>' | '<' | '>=' | '<=' | '==';
  value: number;
}

export interface TimeScheduleConfig {
  days: ('monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday')[];
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  timezone: string;
}

export type TriggerConfig =
  | RangeBreakoutConfig
  | PriceBreakoutConfig
  | WebhookConfig
  | OrderStatusConfig
  | WaitTimeConfig
  | PortfolioCheckConfig
  | SymbolDetailsConfig
  | OrderbookCheckConfig
  | TimeScheduleConfig;

// ============================================================================
// ACTION NODES
// ============================================================================

export type ActionType =
  | 'place_order'
  | 'place_options_order'
  | 'modify_order'
  | 'cancel_order'
  | 'square_off'
  | 'stop_automation'
  | 'send_alert'
  | 'trailing_sl';

export interface ActionNode extends BaseNode {
  type: 'action';
  actionType: ActionType;
  config: ActionConfig;
  outcomeNodes: {
    continue?: string;
    target_hit?: string;
    sl_hit?: string;
    rejected?: string;
    executed?: string;
    cancelled?: string;
  };
}

// Action Configurations

export interface PlaceOrderConfig {
  tradingsymbol?: string;
  instrumentToken?: number;
  exchange: 'NSE' | 'BSE' | 'NFO' | 'BFO' | 'MCX';
  transactionType: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
  quantity: number;
  price?: number;
  triggerPrice?: number;
  
  // Risk management
  stopLoss?: {
    type: 'percentage' | 'points' | 'price';
    value: number;
  };
  target?: {
    type: 'percentage' | 'points' | 'price';
    value: number;
  };
  trailingStopLoss?: {
    enabled: boolean;
    trailBy: number; // percentage
  };
}

export interface PlaceOptionsOrderConfig {
  underlying: string; // "NIFTY", "BANKNIFTY"
  optionType: 'CE' | 'PE';
  strikeSelection: {
    type: 'ATM' | 'OTM' | 'ITM';
    offset: number; // OTM+2, ITM-1, etc
  };
  expiry: 'weekly' | 'monthly' | 'next_week' | 'next_month';
  transactionType: 'BUY' | 'SELL';
  quantity: number;
  orderType: 'MARKET' | 'LIMIT';
  price?: number;
  
  // Risk management
  stopLoss?: {
    type: 'percentage' | 'points' | 'premium';
    value: number;
  };
  target?: {
    type: 'percentage' | 'points' | 'premium';
    value: number;
  };
  trailingStopLoss?: {
    enabled: boolean;
    trailBy: number;
  };
}

export interface ModifyOrderConfig {
  orderId: string;
  quantity?: number;
  price?: number;
  triggerPrice?: number;
  orderType?: 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
}

export interface CancelOrderConfig {
  orderId?: string; // If not provided, cancels all pending orders
  cancelAll?: boolean;
}

export interface SquareOffConfig {
  scope: 
    | 'all_positions'
    | 'automation_positions'
    | 'segment'
    | 'all_options'
    | 'nse_options'
    | 'commodity'
    | 'intraday';
  segment?: 'NSE' | 'NFO' | 'MCX';
}

export interface StopAutomationConfig {
  stopType: 'automation_only' | 'automation_and_square_off' | 'automation_and_square_off_current';
}

export interface SendAlertConfig {
  channels: ('app' | 'email' | 'webhook')[];
  title: string;
  message: string;
  webhookUrl?: string;
}

export interface TrailingStopLossConfig {
  positionId: string;
  trailBy: number; // percentage
  lockProfitAt?: number; // percentage
}

export type ActionConfig =
  | PlaceOrderConfig
  | PlaceOptionsOrderConfig
  | ModifyOrderConfig
  | CancelOrderConfig
  | SquareOffConfig
  | StopAutomationConfig
  | SendAlertConfig
  | TrailingStopLossConfig;

// ============================================================================
// CONDITION NODES
// ============================================================================

export type ConditionType = 'if' | 'and' | 'or' | 'any';

export interface ConditionNode extends BaseNode {
  type: 'condition';
  conditionType: ConditionType;
  checks: Check[];
  trueNode?: string;
  falseNode?: string;
  anyNodes?: string[]; // For ANY type - parallel monitoring
}

export interface Check {
  checkType:
    | 'time_window'
    | 'portfolio_limit'
    | 'price_condition'
    | 'spread_check'
    | 'volume_check'
    | 'indicator_value'
    | 'market_regime'
    | 'position_count'
    | 'order_status';
  
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  value: number | string | boolean;
  field?: string; // Field to check (e.g., 'pnl', 'positions', 'rsi')
}

// ============================================================================
// WORKFLOW DEFINITION
// ============================================================================

export type WorkflowNode = TriggerNode | ActionNode | ConditionNode;

export interface WorkflowEdge {
  id: string;
  from: string;
  to: string;
  condition?: string; // For outcome-based branching
  label?: string;
}

export interface WorkflowDefinition {
  id?: number;
  userId: string;
  name: string;
  description?: string;
  
  // Graph structure
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  startNodeId: string;
  
  // Execution control
  isActive: boolean;
  isDraft: boolean;
  
  // Schedule
  schedule: {
    enabled: boolean;
    days: string[];
    startTime: string;
    endTime: string;
    timezone: string;
  };
  
  // Metadata
  createdAt?: string;
  updatedAt?: string;
  lastExecutedAt?: string;
  
  // Stats
  totalExecutions?: number;
  successfulExecutions?: number;
  failedExecutions?: number;
  version?: number;
}

// ============================================================================
// WORKFLOW EXECUTION
// ============================================================================

export interface WorkflowExecution {
  id: number;
  workflowId: number;
  userId: string;
  
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'failed' | 'stopped' | 'cancelled';
  
  executionPath: string[];
  nodeOutputs: Record<string, NodeExecutionResult>;
  
  ordersPlaced: number;
  signalsGenerated: number;
  positionsOpened: number;
  positionsClosed: number;
  
  errorMessage?: string;
  errorNodeId?: string;
  
  executionTimeMs?: number;
  marketContext?: Record<string, unknown>;
}

export interface NodeExecutionResult {
  nodeId: string;
  nodeType: NodeType;
  status: 'success' | 'failed' | 'skipped';
  output?: unknown;
  error?: string;
  executionTimeMs: number;
  timestamp: string;
}

// ============================================================================
// WORKFLOW VALIDATION
// ============================================================================

export interface ValidationError {
  nodeId?: string;
  edgeId?: string;
  type: 'error' | 'warning';
  code: string;
  message: string;
  suggestion?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

// ============================================================================
// WORKFLOW TEMPLATES
// ============================================================================

export interface WorkflowTemplate {
  id: number;
  name: string;
  description?: string;
  category: 'intraday' | 'swing' | 'scalping' | 'options' | 'multi_leg' | 'risk_management';
  
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  startNodeId: string;
  
  isPublic: boolean;
  createdBy?: string;
  
  usageCount: number;
  avgWinRate?: number;
  avgProfitFactor?: number;
  
  tags: string[];
  
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// SCANNER OPPORTUNITIES
// ============================================================================

export interface ScannerOpportunity {
  id: number;
  userId?: string;
  
  instrumentToken: number;
  tradingsymbol: string;
  exchange: string;
  
  triggerType: string;
  triggerDetails: Record<string, unknown>;
  
  currentPrice: number;
  volume?: number;
  spread?: number;
  
  suggestedAction: 'BUY' | 'SELL';
  suggestedEntry: number;
  suggestedSl: number;
  suggestedTarget: number;
  riskRewardRatio?: number;
  
  confidenceScore: number;
  reasoning: string;
  
  canAutomate: boolean;
  convertedToWorkflowId?: number;
  
  status: 'active' | 'expired' | 'executed' | 'ignored';
  createdAt: string;
  expiresAt: string;
}

// ============================================================================
// WORKFLOW ANALYTICS
// ============================================================================

export interface WorkflowAnalytics {
  id: number;
  workflowId: number;
  userId: string;
  
  periodStart: string;
  periodEnd: string;
  
  // Execution metrics
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  avgExecutionTimeMs: number;
  
  // Trading metrics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalPnl: number;
  
  // Performance metrics
  winRate: number;
  profitFactor: number;
  avgProfit: number;
  avgLoss: number;
  maxDrawdown: number;
  sharpeRatio?: number;
  
  // Node performance
  nodeSuccessRates: Record<string, number>;
  
  createdAt: string;
}

// ============================================================================
// EXECUTION CONTEXT
// ============================================================================

export interface ExecutionContext {
  userId: string;
  workflowId: number;
  executionId: number;
  
  // Market data
  marketData: {
    [instrumentToken: number]: {
      price: number;
      volume: number;
      timestamp: string;
    };
  };
  
  // User state
  portfolio: {
    totalPnl: number;
    openPositions: number;
    availableMargin: number;
  };
  
  // Broker state
  broker?: {
    accessToken: string;
    tokenExpiresAt: string;
  };
  
  // Workflow state
  variables: Record<string, unknown>;
  
  // Execution metadata
  startTime: string;
  currentNodeId?: string;
}

// ============================================================================
// API TYPES
// ============================================================================

export interface CreateWorkflowRequest {
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  startNodeId: string;
  schedule?: WorkflowDefinition['schedule'];
}

export interface UpdateWorkflowRequest extends Partial<CreateWorkflowRequest> {
  isActive?: boolean;
  isDraft?: boolean;
}

export interface ExecuteWorkflowRequest {
  workflowId: number;
  dryRun?: boolean;
  context?: Partial<ExecutionContext>;
}

export interface ConvertOpportunityRequest {
  opportunityId: number;
  workflowName: string;
  autoActivate?: boolean;
}
