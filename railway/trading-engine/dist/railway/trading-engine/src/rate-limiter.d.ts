export declare function isRateLimited(userId: string): Promise<boolean>;
export declare function isOrderRateLimited(userId: string): Promise<boolean>;
export declare function incrementRateLimit(userId: string, type: "order" | "evaluation"): Promise<void>;
//# sourceMappingURL=rate-limiter.d.ts.map