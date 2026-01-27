import { ZairothInstruction } from './parser';
import { ValidationResult } from './validator';
import { ZairothResultV2 } from './v2';
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
export declare function processZairoth(input: string, version?: '1.0' | '2.0'): ZairothResult | ZairothResultV2;
export declare function processZairothSafe(input: string, version?: '1.0' | '2.0'): {
    success: true;
    result: ZairothResult | ZairothResultV2;
} | {
    success: false;
    error: string;
    validation?: ValidationResult;
};
export declare function evaluateSafety(instructions: ZairothInstruction[], context: Record<string, unknown>): {
    stop: boolean;
    reason?: string;
};
//# sourceMappingURL=index.d.ts.map