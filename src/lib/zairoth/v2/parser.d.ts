import { ZairothInstruction } from '../parser';
export interface ZairothInstructionV2 extends ZairothInstruction {
    condition?: string;
    version: '2.0';
}
export declare function parseZairothV2(input: string): ZairothInstructionV2[];
//# sourceMappingURL=parser.d.ts.map