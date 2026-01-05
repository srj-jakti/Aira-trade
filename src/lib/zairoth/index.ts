import { parseZairoth, ZairothInstruction } from './parser';
import { validateZairoth, validateZairothSafe, checkHardKillSwitches, ValidationResult } from './validator';
import { compileZairoth, CanonicalIntent } from './compiler';
import { ZairothError, ZairothErrorCode } from './errors';

export * from './parser';
export * from './validator';
export * from './compiler';
export * from './errors';

export interface ZairothResult {
  instructions: ZairothInstruction[];
  canonical: CanonicalIntent[];
  raw: string;
  validation: ValidationResult;
}

export function processZairoth(input: string): ZairothResult {
  try {
    const instructions = parseZairoth(input);
    validateZairoth(instructions);
    const validation = validateZairothSafe(instructions);
    const canonical = compileZairoth(instructions);
    
    return {
      instructions,
      canonical,
      raw: input,
      validation
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

export function processZairothSafe(input: string): { success: true; result: ZairothResult } | { success: false; error: string; validation?: ValidationResult } {
  try {
    const result = processZairoth(input);
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
