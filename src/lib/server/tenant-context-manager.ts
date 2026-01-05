import { supabaseAdmin } from "@/lib/supabase/admin";

export interface TenantContext {
  userId: string;
  sessionId: string;
  preferences: TenantPreferences;
  limits: TenantLimits;
  createdAt: Date;
}

export interface TenantPreferences {
  riskLevel: "low" | "medium" | "high";
  tradingStyle: "scalping" | "intraday" | "swing" | "position";
  preferredMarkets: string[];
  autoTradeEnabled: boolean;
}

export interface TenantLimits {
  maxDailyTrades: number;
  maxCapitalPerTrade: number;
  maxTotalCapital: number;
  maxAiRequestsPerDay: number;
}

const DEFAULT_PREFERENCES: TenantPreferences = {
  riskLevel: "medium",
  tradingStyle: "intraday",
  preferredMarkets: ["NIFTY", "BANKNIFTY"],
  autoTradeEnabled: false,
};

const DEFAULT_LIMITS: TenantLimits = {
  maxDailyTrades: 50,
  maxCapitalPerTrade: 100000,
  maxTotalCapital: 500000,
  maxAiRequestsPerDay: 100,
};

class TenantContextManager {
  private static instance: TenantContextManager;
  private contextCache: Map<string, TenantContext> = new Map();
  private readonly CACHE_TTL = 300000;

  private constructor() {}

  static getInstance(): TenantContextManager {
    if (!TenantContextManager.instance) {
      TenantContextManager.instance = new TenantContextManager();
    }
    return TenantContextManager.instance;
  }

  async getContext(userId: string): Promise<TenantContext> {
    const cached = this.contextCache.get(userId);
    if (cached && Date.now() - cached.createdAt.getTime() < this.CACHE_TTL) {
      return cached;
    }

    const context = await this.loadContext(userId);
    this.contextCache.set(userId, context);
    return context;
  }

  private async loadContext(userId: string): Promise<TenantContext> {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("trading_preferences, risk_settings")
      .eq("id", userId)
      .single();

    const { data: subscription } = await supabaseAdmin
      .from("subscriptions")
      .select("plan_id, limits")
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    const preferences: TenantPreferences = {
      ...DEFAULT_PREFERENCES,
      ...(profile?.trading_preferences || {}),
      riskLevel: profile?.risk_settings?.riskLevel || "medium",
    };

    const limits: TenantLimits = {
      ...DEFAULT_LIMITS,
      ...(subscription?.limits || {}),
    };

    return {
      userId,
      sessionId: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      preferences,
      limits,
      createdAt: new Date(),
    };
  }

  async wrapRequest<T>(
    userId: string,
    operation: (context: TenantContext) => Promise<T>
  ): Promise<T> {
    const context = await this.getContext(userId);

    const canProceed = await this.checkLimits(context);
    if (!canProceed.allowed) {
      throw new Error(`Tenant limit exceeded: ${canProceed.reason}`);
    }

    try {
      const result = await operation(context);
      await this.logUsage(context, "success");
      return result;
    } catch (error) {
      await this.logUsage(context, "error", error instanceof Error ? error.message : "Unknown error");
      throw error;
    }
  }

  private async checkLimits(context: TenantContext): Promise<{ allowed: boolean; reason?: string }> {
    const { data: usage } = await supabaseAdmin
      .from("tenant_usage")
      .select("ai_requests_today, trades_today")
      .eq("user_id", context.userId)
      .eq("date", new Date().toISOString().split("T")[0])
      .single();

    if (usage) {
      if (usage.ai_requests_today >= context.limits.maxAiRequestsPerDay) {
        return { allowed: false, reason: "Daily AI request limit exceeded" };
      }
      if (usage.trades_today >= context.limits.maxDailyTrades) {
        return { allowed: false, reason: "Daily trade limit exceeded" };
      }
    }

    return { allowed: true };
  }

  private async logUsage(context: TenantContext, status: "success" | "error", error?: string): Promise<void> {
    const today = new Date().toISOString().split("T")[0];

    const { data: existing } = await supabaseAdmin
      .from("tenant_usage")
      .select("id, ai_requests_today")
      .eq("user_id", context.userId)
      .eq("date", today)
      .single();

    if (existing) {
      await supabaseAdmin
        .from("tenant_usage")
        .update({
          ai_requests_today: existing.ai_requests_today + 1,
          last_request_at: new Date().toISOString(),
          last_error: status === "error" ? error : null,
        })
        .eq("id", existing.id);
    } else {
      await supabaseAdmin.from("tenant_usage").insert({
        user_id: context.userId,
        date: today,
        ai_requests_today: 1,
        trades_today: 0,
        last_request_at: new Date().toISOString(),
        last_error: status === "error" ? error : null,
      });
    }
  }

  async getIsolatedMemory(userId: string): Promise<Record<string, unknown>> {
    const { data } = await supabaseAdmin
      .from("tenant_memory")
      .select("key, value")
      .eq("user_id", userId);

    const memory: Record<string, unknown> = {};
    (data || []).forEach((row: { key: string; value: unknown }) => {
      memory[row.key] = row.value;
    });

    return memory;
  }

  async setIsolatedMemory(userId: string, key: string, value: unknown): Promise<void> {
    await supabaseAdmin.from("tenant_memory").upsert({
      user_id: userId,
      key,
      value,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,key" });
  }

  clearCache(userId?: string): void {
    if (userId) {
      this.contextCache.delete(userId);
    } else {
      this.contextCache.clear();
    }
  }

  async ensureIsolation(userId: string, otherUserId: string): Promise<boolean> {
    if (userId === otherUserId) return false;
    
    const context1 = await this.getContext(userId);
    const context2 = await this.getContext(otherUserId);
    
    return context1.sessionId !== context2.sessionId;
  }
}

export const tenantContextManager = TenantContextManager.getInstance();
