import { ZairothInstruction } from './parser';
export interface ValidationResult {
    valid: boolean;
    errors: Array<{
        line: number;
        code: string;
        message: string;
    }>;
    warnings: Array<{
        line: number;
        message: string;
    }>;
}
export declare function validateZairoth(instructions: ZairothInstruction[]): void;
export declare function validateZairothSafe(instructions: ZairothInstruction[]): ValidationResult;
export interface VolatilityContext {
    level: 'normal' | 'high' | 'extreme';
    vix?: number;
    atr?: number;
}
export declare function applyVolatilityGating(instructions: ZairothInstruction[], volatility: VolatilityContext): {
    gatedInstructions: ZairothInstruction[];
    violations: Array<{
        line: number;
        message: string;
        severity: 'warning' | 'error';
    }>;
};
/**
 * Check if any instruction is a hard kill-switch (XA) that should stop execution.
 */
export declare function checkHardKillSwitches(instructions: ZairothInstruction[], context: any): {
    stop: boolean;
    reason?: string;
};
//# sourceMappingURL=validator.d.ts.map