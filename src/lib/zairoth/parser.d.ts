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
export declare function parseZairoth(input: string): ZairothInstruction[];
//# sourceMappingURL=parser.d.ts.map