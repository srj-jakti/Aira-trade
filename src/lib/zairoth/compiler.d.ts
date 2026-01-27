import { ZairothInstruction } from './parser';
export interface CanonicalIntent {
    state: 'fact' | 'active' | 'intent' | 'prohibited';
    action: string;
    market?: string;
    timeframe?: string;
    risk?: string;
    confidence: number;
    params: Record<string, any>;
    raw: string;
}
export declare function compileZairoth(instructions: ZairothInstruction[]): CanonicalIntent[];
//# sourceMappingURL=compiler.d.ts.map