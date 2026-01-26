import { supabaseAdmin } from "@/lib/supabase/admin";

export type AIAction = "analyze" | "generate" | "improve" | "format";

interface AIUsageLimit {
  daily: number;
  monthly: number;
}

const LIMITS: Record<string, AIUsageLimit> = {
  basic: { daily: 10, monthly: 200 },
  pro: { daily: 50, monthly: 1000 },
  elite: { daily: 200, monthly: 5000 },
  admin: { daily: 1000, monthly: 20000 },
  default: { daily: 5, monthly: 50 },
};

export async function logAIUsage(
  userId: string,
  action: AIAction,
  tokensUsed: number,
  model?: string,
  metadata?: any
) {
  try {
    const { error } = await supabaseAdmin
      .from("ai_usage_log")
      .insert({
        user_id: userId,
        action,
        tokens_used: tokensUsed,
        model,
        metadata,
      });

    if (error) throw error;
  } catch (err) {
    console.error("Failed to log AI usage:", err);
  }
}

export async function checkAILimit(userId: string, planId: string = "default"): Promise<{
  allowed: boolean;
  reason?: string;
  usage?: { daily: number; monthly: number; limits: AIUsageLimit };
}> {
  try {
    const limits = LIMITS[planId] || LIMITS.default;
    
    // Get start of today and month in UTC
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    
    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);

    // Get daily usage count
    const { count: dailyCount, error: dailyError } = await supabaseAdmin
      .from("ai_usage_log")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", today.toISOString());

    if (dailyError) throw dailyError;

    // Get monthly usage count
    const { count: monthlyCount, error: monthlyError } = await supabaseAdmin
      .from("ai_usage_log")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", startOfMonth.toISOString());

    if (monthlyError) throw monthlyError;

    const currentDaily = dailyCount || 0;
    const currentMonthly = monthlyCount || 0;

    if (currentDaily >= limits.daily) {
      return { 
        allowed: false, 
        reason: "Daily AI usage limit reached",
        usage: { daily: currentDaily, monthly: currentMonthly, limits }
      };
    }

    if (currentMonthly >= limits.monthly) {
      return { 
        allowed: false, 
        reason: "Monthly AI usage limit reached",
        usage: { daily: currentDaily, monthly: currentMonthly, limits }
      };
    }

    return { 
      allowed: true, 
      usage: { daily: currentDaily, monthly: currentMonthly, limits }
    };
  } catch (err) {
    console.error("Error checking AI limits:", err);
    return { allowed: true }; // Allow on error to not block user, but log it
  }
}
