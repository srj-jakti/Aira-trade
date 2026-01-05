import { parseZairoth, ZairothInstruction } from './parser';
import { validateZairoth, validateZairothSafe, checkHardKillSwitches, ValidationResult } from './validator';
import { compileZairoth } from './compiler';
import { ZairothError, ZairothErrorCode } from './errors';
import { processZairothV2, ZairothResultV2 } from './v2';

export * from './parser';
export * from './validator';
export * from './compiler';
export * from './errors';
export * from './v2';

export interface ZairothResult {
  instructions: ZairothInstruction[];
  validation: ValidationResult;
  canonical: string;
  version?: '1.0' | '2.0';
}

export function processZairoth(input: string, version: '1.0' | '2.0' = '1.0'): ZairothResult | ZairothResultV2 {
  if (version === '2.0') {
    return processZairothV2(input);
  }

  try {
    const instructions = parseZairoth(input);
    validateZairoth(instructions);
    const validation = validateZairothSafe(instructions);
    const canonical = compileZairoth(instructions);
    
    return {
      instructions,
      validation,
      canonical,
      version: '1.0'
    };
  } catch (error) {
    if (error instanceof ZairothError) {
      throw error;
    }
    throw new ZairothError(
      ZairothErrorCode.PARSING_ERROR,
      error instanceof Error ? error.message : 'Unknown parsing error'
    );
  }
}

export function processZairothSafe(input: string, version: '1.0' | '2.0' = '1.0'): { success: true; result: ZairothResult | ZairothResultV2 } | { success: false; error: string; validation?: ValidationResult } {
  try {
    const result = processZairoth(input, version);
    return { success: true, result };
  } catch (error) {
    if (error instanceof ZairothError) {
      return { 
        success: false, 
        error: error.message,
        validation: { valid: false, errors: [{ line: error.line || 0, code: error.code, message: error.message }], warnings: [] }
      };
    }
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export function evaluateSafety(instructions: ZairothInstruction[], context: Record<string, unknown>) {
  return checkHardKillSwitches(instructions, context);
}
