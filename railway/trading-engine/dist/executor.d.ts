export interface BrokerCredentials {
    id: string;
    user_id: string;
    api_key: string;
    access_token: string;
    token_expires_at: string | null;
}
export interface Signal {
    action: "BUY" | "SELL" | "HOLD";
    instrument: string;
    instrumentToken: number;
    price: number;
    stopLoss: number;
    target: number;
    confidence: number;
    reasoning: string;
    quantity?: number;
    safe?: boolean;
}
export interface UserConfig {
    user_id: string;
    risk_per_trade: number;
    max_daily_loss: number;
    max_trades_per_day: number;
    capital?: number;
}
export interface OrderResult {
    success: boolean;
    order_id?: string;
    status?: string;
    error?: string;
}
export declare function getBrokerCredentials(userId: string): Promise<BrokerCredentials | null>;
export declare function isTokenExpired(tokenExpiry: string | null): boolean;
export declare function markTokenExpired(userId: string): Promise<void>;
export declare function closePosition(userId: string, broker: BrokerCredentials, position: {
    tradingsymbol: string;
    quantity: number;
    position_type: "LONG" | "SHORT";
}, reason: string): Promise<OrderResult>;
export declare function executePaperOrder(userId: string, signal: Signal, config: UserConfig, strategyId?: string): Promise<OrderResult>;
export declare function executeOrder(userId: string, broker: BrokerCredentials, signal: Signal, config: UserConfig, strategyId?: string): Promise<OrderResult>;
export declare function fetchOrderStatus(broker: BrokerCredentials, orderId: string): Promise<string>;
//# sourceMappingURL=executor.d.ts.map