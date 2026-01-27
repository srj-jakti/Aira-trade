import { ZairothInstructionV2 } from './parser';
import { ValidationResult } from '../validator';
export * from './parser';
export * from './validator';
export interface ZairothResultV2 {
    instructions: ZairothInstructionV2[];
    validation: ValidationResult;
    version: '2.0';
}
export declare function processZairothV2(input: string): ZairothResultV2;
//# sourceMappingURL=index.d.ts.map