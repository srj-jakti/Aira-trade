import { supabase } from "./supabase";
import { logger } from "./logger";

/**
 * Acquire execution lock for a user to prevent concurrent evaluations
 */
export async function acquireExecutionLock(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("trading_preferences")
      .update({ 
        execution_lock: true,
        last_evaluation_at: new Date().toISOString()
      })
      .eq("user_id", userId)
      .eq("execution_lock", false)
      .select("user_id")
      .single();

    if (error || !data) return false;
    return true;
  } catch (err) {
    logger.error(`Error acquiring lock for ${userId}`, err);
    return false;
  }
}

/**
 * Release execution lock and set next evaluation time
 */
export async function releaseExecutionLock(
  userId: string, 
  nextEvaluationAt: string,
  error?: string
): Promise<void> {
  try {
    const update: any = {
      execution_lock: false,
      next_evaluation_at: nextEvaluationAt,
      consecutive_failures: error ? supabase.rpc('increment') : 0,
      evaluation_error: error || null
    };

    await supabase
      .from("trading_preferences")
      .update(update)
      .eq("user_id", userId);
  } catch (err) {
    logger.error(`Error releasing lock for ${userId}`, err);
  }
}

/**
 * Release locks that have been held too long (stale)
 */
export async function releaseStaleLocks(): Promise<number> {
  try {
    const staleTime = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count, error } = await supabase
      .from("trading_preferences")
      .update({ execution_lock: false })
      .eq("execution_lock", true)
      .lt("last_evaluation_at", staleTime);

    if (error) throw error;
    return count || 0;
  } catch (err) {
    logger.error("Error releasing stale locks", err);
    return 0;
  }
}

/**
 * Disable auto-trading for a user due to critical error
 */
export async function disableAutoTrading(userId: string, reason: string): Promise<void> {
  try {
    await supabase
      .from("trading_preferences")
      .update({
        auto_trading_enabled: false,
        evaluation_error: reason,
        execution_lock: false
      })
      .eq("user_id", userId);
    
    logger.warn(`Auto-trading disabled for ${userId}: ${reason}`);
  } catch (err) {
    logger.error(`Error disabling auto-trading for ${userId}`, err);
  }
}

/**
 * Calculate next evaluation timestamp based on strategy type
 */
export function calculateNextEvaluation(strategyType: string): string {
  const now = new Date();
  let delayMinutes = 1;

  if (strategyType === "intraday") delayMinutes = 1;
  else if (strategyType === "swing") delayMinutes = 15;
  else if (strategyType === "scalping") delayMinutes = 1; // 1 min min for engine

  return new Date(now.getTime() + delayMinutes * 60 * 1000).toISOString();
}
