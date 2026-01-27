/**
 * Acquire execution lock for a user to prevent concurrent evaluations
 */
export declare function acquireExecutionLock(userId: string): Promise<boolean>;
/**
 * Release execution lock and set next evaluation time
 */
export declare function releaseExecutionLock(userId: string, nextEvaluationAt: string, error?: string): Promise<void>;
/**
 * Release locks that have been held too long (stale)
 */
export declare function releaseStaleLocks(): Promise<number>;
/**
 * Disable auto-trading for a user due to critical error
 */
export declare function disableAutoTrading(userId: string, reason: string): Promise<void>;
/**
 * Calculate next evaluation timestamp based on strategy type
 */
export declare function calculateNextEvaluation(strategyType: string): string;
//# sourceMappingURL=locks.d.ts.map