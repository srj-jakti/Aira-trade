import { parseZairoth, ZairothInstruction } from './parser';
import { validateZairoth, checkHardKillSwitches } from './validator';
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
}

export function processZairoth(input: string): ZairothResult {
  try {
    const instructions = parseZairoth(input);
    validateZairoth(instructions);
    const canonical = compileZairoth(instructions);
    
    return {
      instructions,
      canonical,
      raw: input
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

export function evaluateSafety(instructions: ZairothInstruction[], context: any) {
  return checkHardKillSwitches(instructions, context);
}
