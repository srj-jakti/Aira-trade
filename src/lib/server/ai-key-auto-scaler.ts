import { supabaseAdmin } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/server/encryption";

export type TaskComplexity = "fast" | "standard" | "deep";
export type AIProvider = "openai" | "anthropic" | "google" | "groq";

interface AIKeyConfig {
  id: string;
  provider: AIProvider;
  model: string;
  api_key: string;
  is_active: boolean;
  is_default: boolean;
  priority: number;
  request_count: number;
  error_count: number;
  avg_latency_ms: number;
  cost_per_1k_tokens: number;
  last_request_at: string | null;
  last_error: string | null;
}

interface KeyHealth {
  configId: string;
  provider: AIProvider;
  model: string;
  isHealthy: boolean;
  errorRate: number;
  avgLatency: number;
  requestCount: number;
}

const PROVIDER_COMPLEXITY_MAP: Record<TaskComplexity, AIProvider[]> = {
  fast: ["groq", "google"],
  standard: ["openai", "anthropic"],
  deep: ["anthropic", "openai"],
};

const TASK_TYPE_COMPLEXITY: Record<string, TaskComplexity> = {
  market_trend: "fast",
  trading_signal: "fast",
  zairoth_generation: "standard",
  human_market_analysis: "deep",
  strategy_generation: "deep",
  strategy_evaluation: "standard",
};

class AIKeyAutoScaler {
  private static instance: AIKeyAutoScaler;
  private keyHealthCache: Map<string, KeyHealth> = new Map();
  private lastHealthCheck: number = 0;
  private readonly HEALTH_CHECK_INTERVAL = 60000;

  private constructor() {}

  static getInstance(): AIKeyAutoScaler {
    if (!AIKeyAutoScaler.instance) {
      AIKeyAutoScaler.instance = new AIKeyAutoScaler();
    }
    return AIKeyAutoScaler.instance;
  }

  async getAllActiveKeys(): Promise<AIKeyConfig[]> {
    const { data: configs } = await supabaseAdmin
      .from("admin_ai_configs")
      .select("*")
      .eq("is_active", true)
      .order("priority", { ascending: true });

    return (configs || []) as AIKeyConfig[];
  }

  async getKeyForTask(taskType: string): Promise<AIKeyConfig | null> {
    const complexity = TASK_TYPE_COMPLEXITY[taskType] || "standard";
    const preferredProviders = PROVIDER_COMPLEXITY_MAP[complexity];
    
    const allKeys = await this.getAllActiveKeys();
    
    for (const provider of preferredProviders) {
      const keys = allKeys.filter(k => k.provider === provider);
      const healthyKey = await this.selectHealthiestKey(keys);
      if (healthyKey) {
        return healthyKey;
      }
    }

    return this.selectHealthiestKey(allKeys);
  }

  private async selectHealthiestKey(keys: AIKeyConfig[]): Promise<AIKeyConfig | null> {
    if (keys.length === 0) return null;

    await this.refreshHealthIfNeeded();

    const scoredKeys = keys.map(key => {
      const health = this.keyHealthCache.get(key.id);
      const errorRate = health?.errorRate || (key.error_count / Math.max(key.request_count, 1));
      const latencyScore = Math.min(key.avg_latency_ms || 1000, 5000) / 5000;
      const healthScore = (1 - errorRate) * 0.7 + (1 - latencyScore) * 0.3;
      
      return { key, score: healthScore };
    });

    scoredKeys.sort((a, b) => b.score - a.score);
    return scoredKeys[0]?.key || null;
  }

  private async refreshHealthIfNeeded(): Promise<void> {
    const now = Date.now();
    if (now - this.lastHealthCheck < this.HEALTH_CHECK_INTERVAL) {
      return;
    }

    const keys = await this.getAllActiveKeys();
    
    for (const key of keys) {
      const errorRate = key.error_count / Math.max(key.request_count, 1);
      const isHealthy = errorRate < 0.2 && key.is_active;

      this.keyHealthCache.set(key.id, {
        configId: key.id,
        provider: key.provider,
        model: key.model,
        isHealthy,
        errorRate,
        avgLatency: key.avg_latency_ms || 0,
        requestCount: key.request_count,
      });
    }

    this.lastHealthCheck = now;
  }

  async onKeyError(configId: string, error: string): Promise<void> {
    const health = this.keyHealthCache.get(configId);
    if (health) {
      health.isHealthy = false;
      health.errorRate = Math.min(health.errorRate + 0.1, 1.0);
    }

    await supabaseAdmin
      .from("admin_ai_configs")
      .update({
        last_error: error,
        updated_at: new Date().toISOString(),
      })
      .eq("id", configId);
  }

  async onKeySuccess(configId: string, latencyMs: number): Promise<void> {
    const health = this.keyHealthCache.get(configId);
    if (health) {
      health.isHealthy = true;
      health.avgLatency = (health.avgLatency * 0.9) + (latencyMs * 0.1);
      health.errorRate = Math.max(health.errorRate - 0.05, 0);
    }
  }

  async detectNewKeys(): Promise<AIKeyConfig[]> {
    const { data: newKeys } = await supabaseAdmin
      .from("admin_ai_configs")
      .select("*")
      .eq("is_active", true)
      .is("last_request_at", null);

    if (newKeys && newKeys.length > 0) {
      console.log(`[AIKeyAutoScaler] Detected ${newKeys.length} new AI keys`);
      
      await supabaseAdmin.from("brain_events").insert({
        event_type: "NEW_AI_KEYS_DETECTED",
        details: { count: newKeys.length, keys: newKeys.map(k => ({ id: k.id, provider: k.provider, model: k.model })) },
        created_at: new Date().toISOString(),
      });
    }

    return (newKeys || []) as AIKeyConfig[];
  }

  async getScalingStatus(): Promise<{
    totalKeys: number;
    healthyKeys: number;
    byProvider: Record<string, { count: number; healthy: number }>;
    recommendation: string;
  }> {
    await this.refreshHealthIfNeeded();
    
    const allKeys = await this.getAllActiveKeys();
    const byProvider: Record<string, { count: number; healthy: number }> = {};
    let healthyCount = 0;

    for (const key of allKeys) {
      if (!byProvider[key.provider]) {
        byProvider[key.provider] = { count: 0, healthy: 0 };
      }
      byProvider[key.provider].count++;
      
      const health = this.keyHealthCache.get(key.id);
      if (health?.isHealthy) {
        byProvider[key.provider].healthy++;
        healthyCount++;
      }
    }

    let recommendation = "AI key pool is healthy";
    
    if (healthyCount === 0) {
      recommendation = "CRITICAL: No healthy AI keys available!";
    } else if (healthyCount < 2) {
      recommendation = "WARNING: Only 1 healthy AI key. Add backup keys.";
    } else if (!byProvider["groq"] || byProvider["groq"].healthy === 0) {
      recommendation = "Consider adding Groq for fast tasks (market trend, signals)";
    } else if (!byProvider["anthropic"] || byProvider["anthropic"].healthy === 0) {
      recommendation = "Consider adding Anthropic for deep reasoning tasks";
    }

    return {
      totalKeys: allKeys.length,
      healthyKeys: healthyCount,
      byProvider,
      recommendation,
    };
  }

  async rotateFailedKey(configId: string): Promise<AIKeyConfig | null> {
    const failedKey = this.keyHealthCache.get(configId);
    if (!failedKey) return null;

    const allKeys = await this.getAllActiveKeys();
    const alternativeKeys = allKeys.filter(
      k => k.id !== configId && k.provider === failedKey.provider
    );

    const fallbackKey = await this.selectHealthiestKey(alternativeKeys);
    
    if (fallbackKey) {
      console.log(`[AIKeyAutoScaler] Rotating from ${configId} to ${fallbackKey.id}`);
      
      await supabaseAdmin.from("brain_events").insert({
        event_type: "AI_KEY_ROTATION",
        details: { from: configId, to: fallbackKey.id, reason: "Key failure" },
        created_at: new Date().toISOString(),
      });
    }

    return fallbackKey;
  }
}

export const aiKeyAutoScaler = AIKeyAutoScaler.getInstance();
