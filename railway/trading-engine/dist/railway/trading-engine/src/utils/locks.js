"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.acquireExecutionLock = acquireExecutionLock;
exports.releaseExecutionLock = releaseExecutionLock;
exports.releaseStaleLocks = releaseStaleLocks;
exports.disableAutoTrading = disableAutoTrading;
exports.calculateNextEvaluation = calculateNextEvaluation;
const supabase_1 = require("./supabase");
const logger_1 = require("./logger");
/**
 * Acquire execution lock for a user to prevent concurrent evaluations
 */
async function acquireExecutionLock(userId) {
    try {
        const { data, error } = await supabase_1.supabase
            .from("trading_preferences")
            .update({
            execution_lock: true,
            last_evaluation_at: new Date().toISOString()
        })
            .eq("user_id", userId)
            .eq("execution_lock", false)
            .select("user_id")
            .single();
        if (error || !data)
            return false;
        return true;
    }
    catch (err) {
        logger_1.logger.error(`Error acquiring lock for ${userId}`, err);
        return false;
    }
}
/**
 * Release execution lock and set next evaluation time
 */
async function releaseExecutionLock(userId, nextEvaluationAt, error) {
    try {
        const update = {
            execution_lock: false,
            next_evaluation_at: nextEvaluationAt,
            consecutive_failures: error ? supabase_1.supabase.rpc('increment') : 0,
            evaluation_error: error || null
        };
        await supabase_1.supabase
            .from("trading_preferences")
            .update(update)
            .eq("user_id", userId);
    }
    catch (err) {
        logger_1.logger.error(`Error releasing lock for ${userId}`, err);
    }
}
/**
 * Release locks that have been held too long (stale)
 */
async function releaseStaleLocks() {
    try {
        const staleTime = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const { count, error } = await supabase_1.supabase
            .from("trading_preferences")
            .update({ execution_lock: false })
            .eq("execution_lock", true)
            .lt("last_evaluation_at", staleTime);
        if (error)
            throw error;
        return count || 0;
    }
    catch (err) {
        logger_1.logger.error("Error releasing stale locks", err);
        return 0;
    }
}
/**
 * Disable auto-trading for a user due to critical error
 */
async function disableAutoTrading(userId, reason) {
    try {
        await supabase_1.supabase
            .from("trading_preferences")
            .update({
            auto_trading_enabled: false,
            evaluation_error: reason,
            execution_lock: false
        })
            .eq("user_id", userId);
        logger_1.logger.warn(`Auto-trading disabled for ${userId}: ${reason}`);
    }
    catch (err) {
        logger_1.logger.error(`Error disabling auto-trading for ${userId}`, err);
    }
}
/**
 * Calculate next evaluation timestamp based on strategy type
 */
function calculateNextEvaluation(strategyType) {
    const now = new Date();
    let delayMinutes = 1;
    if (strategyType === "intraday")
        delayMinutes = 1;
    else if (strategyType === "swing")
        delayMinutes = 15;
    else if (strategyType === "scalping")
        delayMinutes = 1; // 1 min min for engine
    return new Date(now.getTime() + delayMinutes * 60 * 1000).toISOString();
}
//# sourceMappingURL=locks.js.map