import { Signal } from "./executor";
export type SignalStatus = "PENDING" | "PENDING_EXECUTION" | "EXECUTING" | "EXECUTED" | "FILLED" | "PARTIALLY_FILLED" | "REJECTED" | "CANCELLED" | "EXPIRED" | "FAILED";
export declare function createSignal(userId: string, strategyId: string | null, signal: Signal, status: SignalStatus, signalType?: "TRADING" | "SCANNER"): Promise<string>;
export declare function updateSignalStatus(signalId: string, status: SignalStatus, reason: string, orderId?: string): Promise<void>;
export declare function updateSignalFromOrderStatus(orderId: string, orderStatus: string): Promise<void>;
export declare function expireOldSignals(): Promise<number>;
//# sourceMappingURL=signal-manager.d.ts.map