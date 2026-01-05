import { ZairothError, ZairothErrorCode } from './errors';

export type ZairothState = 'RA' | 'NA' | 'VA' | 'XA';
export type ZairothCertainty = 0.3 | 0.8 | 1.0;

export interface ZairothInstruction {
  state: ZairothState;
  intent: string;
  action: string;
  object: string;
  context: Record<string, string>;
  certainty: ZairothCertainty;
  raw: string;
}

export function parseZairoth(input: string): ZairothInstruction[] {
  const lines = input.split('\n').filter(line => line.trim() !== '');
  
  return lines.map((line, index) => {
    const trimmed = line.trim();
    const parts = trimmed.split(/\s+/);
    
    // Minimum parts: STATE, INTENT, ACTION, OBJECT, CERTAINTY (CONTEXT is optional but usually expected)
    // Actually the rule says: [STATE] [INTENT] [ACTION] [OBJECT] [CONTEXT] [CERTAINTY]
    // That's 6 parts.
    
    if (parts.length < 5) {
      throw new ZairothError(
        ZairothErrorCode.INVALID_STRUCTURE,
        'Instruction must have at least STATE, INTENT, ACTION, OBJECT, and CERTAINTY',
        index + 1
      );
    }

    const stateStr = parts[0];
    const certaintyStr = parts[parts.length - 1];

    if (!['RA', 'NA', 'VA', 'XA'].includes(stateStr)) {
      throw new ZairothError(
        ZairothErrorCode.MISSING_STATE,
        `Invalid or missing state marker: ${stateStr}`,
        index + 1
      );
    }

    let certainty: ZairothCertainty;
    if (certaintyStr === '•••') certainty = 1.0;
    else if (certaintyStr === '••') certainty = 0.8;
    else if (certaintyStr === '•') certainty = 0.3;
    else {
      throw new ZairothError(
        ZairothErrorCode.MISSING_CERTAINTY,
        `Invalid or missing certainty marker: ${certaintyStr}`,
        index + 1
      );
    }

    const intent = parts[1];
    const action = parts[2];
    const object = parts[3];
    
    // Remaining parts between object and certainty are context
    const contextParts = parts.slice(4, parts.length - 1);
    const context: Record<string, string> = {};
    
    contextParts.forEach(part => {
      if (part.includes(':')) {
        const [key, value] = part.split(':');
        context[key] = value;
      } else if (part.includes('-')) {
        // Handle tf-5m or risk-low
        const [key, value] = part.split('-');
        context[key] = value;
      } else {
        // Generic key-value if possible, or just treat as a tag
        context[part] = 'true';
      }
    });

    return {
      state: stateStr as ZairothState,
      intent,
      action,
      object,
      context,
      certainty,
      raw: trimmed
    };
  });
}
