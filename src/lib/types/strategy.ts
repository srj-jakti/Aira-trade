export type IndicatorType =
  | "RSI"
  | "SMA"
  | "EMA"
  | "WMA"
  | "DEMA"
  | "VWAP"
  | "MACD"
  | "MACD_SIGNAL"
  | "MACD_HIST"
  | "SUPERTREND"
  | "SUPERTREND_DIR"
  | "ADX"
  | "ATR"
  | "STOCH_K"
  | "STOCH_D"
  | "BB_UPPER"
  | "BB_MIDDLE"
  | "BB_LOWER"
  | "OBV"
  | "CCI"
  | "WILLIAMS_R";

export type PriceField = "open" | "high" | "low" | "close" | "volume";

export type ComparisonOperator =
  | ">"
  | "<"
  | ">="
  | "<="
  | "=="
  | "CROSS_ABOVE"
  | "CROSS_BELOW";

export type TrendDirection = "BULLISH" | "BEARISH";

export type PatternType =
  | "HAMMER"
  | "SHOOTING_STAR"
  | "DOJI"
  | "BULLISH_ENGULFING"
  | "BEARISH_ENGULFING"
  | "MORNING_STAR"
  | "EVENING_STAR"
  | "THREE_WHITE_SOLDIERS"
  | "THREE_BLACK_CROWS"
  | "INSIDE_BAR";

export type RuleLogic = "AND" | "OR";

export interface IndicatorRule {
  type: "indicator";
  name: IndicatorType;
  period?: number;
  operator: ComparisonOperator;
  value: number;
}

export interface PriceVsIndicatorRule {
  type: "price_vs_indicator";
  priceField: PriceField;
  operator: ComparisonOperator;
  indicator: IndicatorType;
  indicatorPeriod?: number;
}

export interface IndicatorVsIndicatorRule {
  type: "indicator_vs_indicator";
  indicator1: IndicatorType;
  period1?: number;
  operator: ComparisonOperator;
  indicator2: IndicatorType;
  period2?: number;
}

export interface TrendRule {
  type: "trend";
  indicator: "SUPERTREND" | "ADX";
  direction?: TrendDirection;
  threshold?: number;
}

export interface PatternRule {
  type: "pattern";
  pattern: PatternType;
}

export interface PriceActionRule {
  type: "price_action";
  action:
    | "BULLISH_CANDLE"
    | "BEARISH_CANDLE"
    | "HIGHER_HIGH"
    | "LOWER_LOW"
    | "HIGHER_LOW"
    | "LOWER_HIGH"
    | "GAP_UP"
    | "GAP_DOWN"
    | "CLOSE_ABOVE_HIGH_1"
    | "CLOSE_BELOW_LOW_1";
}

export interface VolumeRule {
  type: "volume";
  operator: ComparisonOperator;
  value?: number;
  compareToAverage?: boolean;
  averagePeriod?: number;
  multiplier?: number;
}

export type StrategyRule =
  | IndicatorRule
  | PriceVsIndicatorRule
  | IndicatorVsIndicatorRule
  | TrendRule
  | PatternRule
  | PriceActionRule
  | VolumeRule;

export interface RuleSet {
  logic: RuleLogic;
  rules: StrategyRule[];
}

export interface ExitParameters {
  type: "PERCENTAGE" | "ATR_MULTIPLE" | "FIXED";
  value: number;
  atrPeriod?: number;
}

export type StrategyType = "SWING" | "INTRADAY" | "SCALPING" | "OPTIONS";

export interface ExecutableStrategy {
  name: string;
  description: string;
  version: number;
  strategyType?: StrategyType;
  
  buy: RuleSet;
  sell: RuleSet;
  hold?: RuleSet;
  
  buyExit: {
    stopLoss: ExitParameters;
    target: ExitParameters;
    trailingSL?: {
      enabled: boolean;
      activationPercent?: number;
      trailPercent?: number;
    };
  };
  
  sellExit: {
    stopLoss: ExitParameters;
    target: ExitParameters;
    trailingSL?: {
      enabled: boolean;
      activationPercent?: number;
      trailPercent?: number;
    };
  };
  
  requiredIndicators: Array<{
    name: IndicatorType;
    period?: number;
  }>;
  
  minWarmupCandles: number;
}

export interface EvaluationLog {
  candle: {
    index: number;
    timestamp: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  };
  buyEvaluation: {
    result: boolean;
    ruleResults: Array<{
      rule: StrategyRule;
      passed: boolean;
      actualValue?: number;
      expectedValue?: number;
      reason?: string;
    }>;
  };
  sellEvaluation: {
    result: boolean;
    ruleResults: Array<{
      rule: StrategyRule;
      passed: boolean;
      actualValue?: number;
      expectedValue?: number;
      reason?: string;
    }>;
  };
  holdEvaluation?: {
    result: boolean;
    ruleResults: Array<{
      rule: StrategyRule;
      passed: boolean;
      actualValue?: number;
      expectedValue?: number;
      reason?: string;
    }>;
  };
  finalSignal: "BUY" | "SELL" | "HOLD";
  signalReason: string;
}

export interface ExecutionResult {
  buySignal: boolean;
  sellSignal: boolean;
  holdInfo: boolean;
  log: EvaluationLog;
  indicatorValues: Record<string, number>;
}

export function getRequiredWarmupPeriod(strategy: ExecutableStrategy): number {
  let maxPeriod = 20;
  
  for (const ind of strategy.requiredIndicators) {
    const period = ind.period || 14;
    if (ind.name === "SMA" || ind.name === "EMA" || ind.name === "WMA" || ind.name === "DEMA") {
      maxPeriod = Math.max(maxPeriod, period + 5);
    } else if (ind.name === "RSI" || ind.name === "ADX" || ind.name === "ATR") {
      maxPeriod = Math.max(maxPeriod, period + 10);
    } else if (ind.name === "MACD") {
      maxPeriod = Math.max(maxPeriod, 26 + 9 + 5);
    } else if (ind.name === "SUPERTREND") {
      maxPeriod = Math.max(maxPeriod, 10 + 14);
    }
  }
  
  return maxPeriod;
}

export function validateStrategy(strategy: ExecutableStrategy): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!strategy.name || strategy.name.trim().length === 0) {
    errors.push("Strategy name is required");
  }
  
  if (!strategy.buy || !strategy.buy.rules || strategy.buy.rules.length === 0) {
    errors.push("At least one BUY rule is required");
  }
  
  if (!strategy.sell || !strategy.sell.rules || strategy.sell.rules.length === 0) {
    errors.push("At least one SELL rule is required");
  }
  
  const validateRule = (rule: StrategyRule, context: string): void => {
    if (!rule.type) {
      errors.push(`${context}: Rule type is required`);
      return;
    }
    
    switch (rule.type) {
      case "indicator":
        if (!rule.name) errors.push(`${context}: Indicator name is required`);
        if (!rule.operator) errors.push(`${context}: Operator is required`);
        if (rule.value === undefined) errors.push(`${context}: Value is required`);
        break;
      case "price_vs_indicator":
        if (!rule.priceField) errors.push(`${context}: Price field is required`);
        if (!rule.indicator) errors.push(`${context}: Indicator is required`);
        if (!rule.operator) errors.push(`${context}: Operator is required`);
        break;
      case "indicator_vs_indicator":
        if (!rule.indicator1) errors.push(`${context}: Indicator 1 is required`);
        if (!rule.indicator2) errors.push(`${context}: Indicator 2 is required`);
        if (!rule.operator) errors.push(`${context}: Operator is required`);
        break;
      case "trend":
        if (!rule.indicator) errors.push(`${context}: Trend indicator is required`);
        break;
      case "pattern":
        if (!rule.pattern) errors.push(`${context}: Pattern type is required`);
        break;
      case "price_action":
        if (!rule.action) errors.push(`${context}: Action type is required`);
        break;
      case "volume":
        if (!rule.operator) errors.push(`${context}: Operator is required`);
        break;
    }
  };
  
  strategy.buy?.rules?.forEach((rule, i) => validateRule(rule, `BUY rule ${i + 1}`));
  strategy.sell?.rules?.forEach((rule, i) => validateRule(rule, `SELL rule ${i + 1}`));
  strategy.hold?.rules?.forEach((rule, i) => validateRule(rule, `HOLD rule ${i + 1}`));
  
  if (!strategy.buyExit?.stopLoss) {
    errors.push("BUY stop loss configuration is required");
  }
  if (!strategy.buyExit?.target) {
    errors.push("BUY target configuration is required");
  }
  if (!strategy.sellExit?.stopLoss) {
    errors.push("SELL stop loss configuration is required");
  }
  if (!strategy.sellExit?.target) {
    errors.push("SELL target configuration is required");
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
