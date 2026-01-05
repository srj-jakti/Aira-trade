import { ZairothInstruction } from './parser';
import { ZairothError, ZairothErrorCode } from './errors';

const VALID_INTENTS = ['trade-buy', 'trade-sell', 'signal', 'market-condition', 'risk-param', 'capital-rule', 'strategy-create', 'strategy-update', 'backtest-run'];
const VALID_ACTIONS = ['Lun', 'condition', 'alert', 'set', 'restrict', 'create', 'update', 'execute'];

export interface ValidationResult {
  valid: boolean;
  errors: Array<{ line: number; code: string; message: string }>;
  warnings: Array<{ line: number; message: string }>;
}

export function validateZairoth(instructions: ZairothInstruction[]): void {
  const actionsByObject: Record<string, Set<string>> = {};

  instructions.forEach((inst, index) => {
    if (!VALID_INTENTS.includes(inst.intent)) {
      throw new ZairothError(
        ZairothErrorCode.UNKNOWN_KEYWORD,
        `Unknown intent: ${inst.intent}. Valid intents: ${VALID_INTENTS.join(', ')}`,
        index + 1
      );
    }

    if (!VALID_ACTIONS.includes(inst.action)) {
      throw new ZairothError(
        ZairothErrorCode.UNKNOWN_KEYWORD,
        `Unknown action: ${inst.action}. Valid actions: ${VALID_ACTIONS.join(', ')}`,
        index + 1
      );
    }

    const key = `${inst.intent}:${inst.action}:${inst.object}`;
    if (!actionsByObject[key]) {
      actionsByObject[key] = new Set();
    }
    
    if (inst.state === 'XA') {
      if (actionsByObject[key].has('VA') || actionsByObject[key].has('NA')) {
        throw new ZairothError(
          ZairothErrorCode.CONFLICTING_RULES,
          `Conflicting state for ${key}: XA cannot coexist with NA/VA`,
          index + 1
        );
      }
    } else if (inst.state === 'NA' || inst.state === 'VA') {
      if (actionsByObject[key].has('XA')) {
        throw new ZairothError(
          ZairothErrorCode.CONFLICTING_RULES,
          `Conflicting state for ${key}: NA/VA cannot coexist with XA`,
          index + 1
        );
      }
    }
    
    actionsByObject[key].add(inst.state);

    if (inst.state === 'VA' && inst.certainty === 1.0) {
      throw new ZairothError(
        ZairothErrorCode.AMBIGUOUS_CONDITION,
        `VA state with absolute certainty (•••) is ambiguous. Use NA for executable actions.`,
        index + 1
      );
    }

    if (inst.state === 'NA' && inst.certainty === 0.3) {
      throw new ZairothError(
        ZairothErrorCode.AMBIGUOUS_CONDITION,
        `NA (active/executable) state with low certainty (•) is dangerous. Use VA for uncertain intents.`,
        index + 1
      );
    }
  });
}

export function validateZairothSafe(instructions: ZairothInstruction[]): ValidationResult {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };
  const actionsByObject: Record<string, Set<string>> = {};

  instructions.forEach((inst, index) => {
    if (!VALID_INTENTS.includes(inst.intent)) {
      result.valid = false;
      result.errors.push({
        line: index + 1,
        code: ZairothErrorCode.UNKNOWN_KEYWORD,
        message: `Unknown intent: ${inst.intent}`
      });
    }

    if (!VALID_ACTIONS.includes(inst.action)) {
      result.valid = false;
      result.errors.push({
        line: index + 1,
        code: ZairothErrorCode.UNKNOWN_KEYWORD,
        message: `Unknown action: ${inst.action}`
      });
    }

    const key = `${inst.intent}:${inst.action}:${inst.object}`;
    if (!actionsByObject[key]) {
      actionsByObject[key] = new Set();
    }
    
    if (inst.state === 'XA' && (actionsByObject[key].has('VA') || actionsByObject[key].has('NA'))) {
      result.valid = false;
      result.errors.push({
        line: index + 1,
        code: ZairothErrorCode.CONFLICTING_RULES,
        message: `Conflicting state for ${key}: XA cannot coexist with NA/VA`
      });
    }
    
    actionsByObject[key].add(inst.state);

    if (inst.state === 'VA' && inst.certainty === 1.0) {
      result.warnings.push({
        line: index + 1,
        message: `VA state with absolute certainty (•••) may be ambiguous`
      });
    }
  });

  return result;
}

export interface VolatilityContext {
  level: 'normal' | 'high' | 'extreme';
  vix?: number;
  atr?: number;
}

export function applyVolatilityGating(
  instructions: ZairothInstruction[],
  volatility: VolatilityContext
): { 
  gatedInstructions: ZairothInstruction[]; 
  violations: Array<{ line: number; message: string; severity: 'warning' | 'error' }>;
} {
  const gatedInstructions: ZairothInstruction[] = [];
  const violations: Array<{ line: number; message: string; severity: 'warning' | 'error' }> = [];

  instructions.forEach((inst, index) => {
    // Rule 1: High Volatility requires High Certainty (1.0) for execution intents (NA)
    if (volatility.level === 'high' || volatility.level === 'extreme') {
      if (inst.state === 'NA' && inst.certainty < 1.0) {
        violations.push({
          line: index + 1,
          message: `Volatility Gating: Execution intent '${inst.intent}' requires absolute certainty (•••) during high/extreme volatility.`,
          severity: 'error'
        });
        return; // Gated out
      }
    }

    // Rule 2: Extreme Volatility invalidates specific intents (e.g., scalping or high-frequency targets)
    if (volatility.level === 'extreme') {
      const restrictedObjects = ['scalp', 'scalping', 'hft', 'quick-flip'];
      if (restrictedObjects.some(obj => inst.object.toLowerCase().includes(obj))) {
        violations.push({
          line: index + 1,
          message: `Volatility Gating: Intent '${inst.intent}' with object '${inst.object}' is restricted during extreme volatility.`,
          severity: 'error'
        });
        return; // Gated out
      }
    }

    // Rule 3: Warning for moderate volatility with medium certainty
    if (volatility.level === 'high' && inst.certainty === 0.6) {
      violations.push({
        line: index + 1,
        message: `Volatility Warning: Medium certainty (••) intent during high volatility. Proceed with caution.`,
        severity: 'warning'
      });
    }

    gatedInstructions.push(inst);
  });

  return { gatedInstructions, violations };
}

/**
 * Check if any instruction is a hard kill-switch (XA) that should stop execution.
 */
export function checkHardKillSwitches(instructions: ZairothInstruction[], context: any): { stop: boolean; reason?: string } {
  for (const inst of instructions) {
    if (inst.state === 'XA') {
      // Example: XA trade-buy capital>20%•••
      // We need to evaluate the context against the rule.
      // For now, if an XA rule exists and its condition (object/context) matches, we stop.
      
      // Basic matching logic:
      if (inst.intent === 'trade-buy' || inst.intent === 'trade-sell') {
        if (inst.object === 'volatile' && context.volatility === 'high') {
          return { stop: true, reason: `Hard Stop: ${inst.raw}` };
        }
        if (inst.object.includes('capital>') && context.capitalUsed) {
          const limit = parseFloat(inst.object.split('>')[1]);
          if (context.capitalUsed > limit) {
            return { stop: true, reason: `Hard Stop: ${inst.raw} (Capital ${context.capitalUsed}% > ${limit}%)` };
          }
        }
      }
    }
  }
  return { stop: false };
}
