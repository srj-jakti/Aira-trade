import { parseZairothV2, ZairothInstructionV2 } from './parser';
import { validateZairothV2 } from './validator';
import { ValidationResult } from '../validator';

export * from './parser';
export * from './validator';

export interface ZairothResultV2 {
  instructions: ZairothInstructionV2[];
  validation: ValidationResult;
  canonical: string;
  raw: string;
  version: '2.0';
}

export function processZairothV2(input: string): ZairothResultV2 {
  const instructions = parseZairothV2(input);
  const validation = validateZairothV2(instructions);
  
  return {
    instructions,
    validation,
    canonical: input, // Simplified for now as V2 compiler might not be ready
    raw: input,
    version: '2.0'
  };
}
