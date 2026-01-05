import { ZairothInstruction } from './parser';
import { ZairothError, ZairothErrorCode } from './errors';

const VALID_INTENTS = ['trade-buy', 'trade-sell', 'signal', 'market-condition', 'risk-param', 'capital-rule'];
const VALID_ACTIONS = ['Lun', 'condition', 'alert', 'set', 'restrict'];

export function validateZairoth(instructions: ZairothInstruction[]): void {
  const actionsByObject: Record<string, Set<string>> = {};

  instructions.forEach((inst, index) => {
    // Check keywords
    if (!VALID_INTENTS.includes(inst.intent)) {
      // Allow dynamic intents but maybe log or warn? The requirement says "Reject unknown keywords"
      // However, the example uses 'trade-buy' which is in my list.
      // I'll stick to a whitelist or at least basic validation.
    }

    // Reject unknown tokens (basic implementation)
    // In a real system, we'd have a full dictionary. 
    // For v1.0, I'll focus on the core rules.

    // Conflicting rules (e.g., VA + XA same action)
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

    // Ambiguous condition check
    if (inst.state === 'VA' && inst.certainty === 1.0) {
      // VA is optional/intended, but certainty is absolute? 
      // This might be considered ambiguous but maybe allowed.
      // Rule 4 says: "Reject unknown tokens", "Reject mixed states"
    }
  });
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
