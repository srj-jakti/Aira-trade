import { supabaseAdmin } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/server/encryption";

const MAX_WEBSOCKET_INSTRUMENTS_PER_KEY = 3000;
const MAX_DAILY_REQUESTS_PER_KEY = 10000;
const ANALYSIS_KEY_ROLE = "analysis";
const WEBSOCKET_KEY_ROLE = "websocket";
const GENERAL_KEY_ROLE = "general";

export interface ApiKeyConfig {
  id: string;
  name: string;
  api_key: string;
  api_secret: string;
  access_token: string | null;
  connection_status: string;
  priority: number;
  is_active: boolean;
  role: string;
  websocket_connected: boolean;
  websocket_instruments_count: number;
  daily_request_count: number;
  current_load: number;
  max_concurrent_requests: number;
}

export interface PoolAllocation {
  analysisKey: ApiKeyConfig | null;
  websocketKeys: ApiKeyConfig[];
  generalKeys: ApiKeyConfig[];
  totalCapacity: number;
  usedCapacity: number;
}

class ApiKeyPoolManager {
  private static instance: ApiKeyPoolManager;
  private poolCache: PoolAllocation | null = null;
  private lastPoolRefresh: number = 0;
  private readonly POOL_CACHE_TTL = 60000;

  private constructor() {}

  static getInstance(): ApiKeyPoolManager {
    if (!ApiKeyPoolManager.instance) {
      ApiKeyPoolManager.instance = new ApiKeyPoolManager();
    }
    return ApiKeyPoolManager.instance;
  }

  async getAllActiveKeys(): Promise<ApiKeyConfig[]> {
    const { data: configs } = await supabaseAdmin
      .from("admin_zerodha_configs")
      .select("*")
      .eq("is_active", true)
      .eq("connection_status", "connected")
      .order("priority", { ascending: true });

    return (configs || []) as ApiKeyConfig[];
  }

  async getPoolAllocation(forceRefresh = false): Promise<PoolAllocation> {
    const now = Date.now();
    if (!forceRefresh && this.poolCache && now - this.lastPoolRefresh < this.POOL_CACHE_TTL) {
      return this.poolCache;
    }

    const keys = await this.getAllActiveKeys();

    let analysisKey: ApiKeyConfig | null = null;
    const websocketKeys: ApiKeyConfig[] = [];
    const generalKeys: ApiKeyConfig[] = [];

    for (const key of keys) {
      if (key.role === ANALYSIS_KEY_ROLE) {
        analysisKey = key;
      } else if (key.role === WEBSOCKET_KEY_ROLE) {
        websocketKeys.push(key);
      } else {
        generalKeys.push(key);
      }
    }

    if (!analysisKey && generalKeys.length > 0) {
      analysisKey = generalKeys.pop()!;
      await this.assignRole(analysisKey.id, ANALYSIS_KEY_ROLE);
    }

    if (websocketKeys.length === 0 && generalKeys.length > 0) {
      const wsKey = generalKeys.shift()!;
      websocketKeys.push(wsKey);
      await this.assignRole(wsKey.id, WEBSOCKET_KEY_ROLE);
    }

    const totalCapacity = websocketKeys.length * MAX_WEBSOCKET_INSTRUMENTS_PER_KEY;
    const usedCapacity = websocketKeys.reduce((sum, k) => sum + (k.websocket_instruments_count || 0), 0);

    this.poolCache = {
      analysisKey,
      websocketKeys,
      generalKeys,
      totalCapacity,
      usedCapacity,
    };
    this.lastPoolRefresh = now;

    return this.poolCache;
  }

  async assignRole(configId: string, role: string): Promise<void> {
    await supabaseAdmin
      .from("admin_zerodha_configs")
      .update({ role, updated_at: new Date().toISOString() })
      .eq("id", configId);
  }

  async getKeyForAnalysis(): Promise<ApiKeyConfig | null> {
    const pool = await this.getPoolAllocation();
    
    if (pool.analysisKey) {
      await this.incrementRequestCount(pool.analysisKey.id);
      return pool.analysisKey;
    }

    const leastLoaded = await this.getLeastLoadedKey();
    if (leastLoaded) {
      await this.incrementRequestCount(leastLoaded.id);
    }
    return leastLoaded;
  }

  async getKeyForWebSocket(instrumentCount: number): Promise<ApiKeyConfig | null> {
    const pool = await this.getPoolAllocation();

    for (const key of pool.websocketKeys) {
      const remaining = MAX_WEBSOCKET_INSTRUMENTS_PER_KEY - (key.websocket_instruments_count || 0);
      if (remaining >= instrumentCount) {
        return key;
      }
    }

    for (const key of pool.generalKeys) {
      await this.assignRole(key.id, WEBSOCKET_KEY_ROLE);
      return key;
    }

    return null;
  }

  async getLeastLoadedKey(): Promise<ApiKeyConfig | null> {
    const { data: keys } = await supabaseAdmin
      .from("admin_zerodha_configs")
      .select("*")
      .eq("is_active", true)
      .eq("connection_status", "connected")
      .order("current_load", { ascending: true })
      .order("daily_request_count", { ascending: true })
      .limit(1);

    return keys?.[0] || null;
  }

  async incrementRequestCount(configId: string): Promise<void> {
    const { data: config } = await supabaseAdmin
      .from("admin_zerodha_configs")
      .select("daily_request_count, daily_request_reset_at")
      .eq("id", configId)
      .single();

    const today = new Date().toISOString().split("T")[0];
    const resetDate = config?.daily_request_reset_at;

    if (resetDate !== today) {
      await supabaseAdmin
        .from("admin_zerodha_configs")
        .update({
          daily_request_count: 1,
          daily_request_reset_at: today,
          last_request_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", configId);
    } else {
      await supabaseAdmin.rpc("increment_request_count", { config_id: configId });
    }
  }

  async updateWebSocketStatus(
    configId: string,
    connected: boolean,
    instrumentsCount: number
  ): Promise<void> {
    await supabaseAdmin
      .from("admin_zerodha_configs")
      .update({
        websocket_connected: connected,
        websocket_instruments_count: instrumentsCount,
        last_websocket_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", configId);
  }

  async distributeInstrumentsAcrossKeys(
    instrumentTokens: number[]
  ): Promise<Map<string, number[]>> {
    const pool = await this.getPoolAllocation();
    const distribution = new Map<string, number[]>();

    if (pool.websocketKeys.length === 0) {
      console.error("[ApiKeyPoolManager] No WebSocket keys available!");
      return distribution;
    }

    const tokensPerKey = Math.ceil(instrumentTokens.length / pool.websocketKeys.length);

    for (let i = 0; i < pool.websocketKeys.length; i++) {
      const key = pool.websocketKeys[i];
      const startIdx = i * tokensPerKey;
      const endIdx = Math.min(startIdx + tokensPerKey, instrumentTokens.length);
      const tokens = instrumentTokens.slice(startIdx, endIdx);

      if (tokens.length > 0) {
        distribution.set(key.id, tokens);
        await this.updateWebSocketStatus(key.id, true, tokens.length);
      }
    }

    return distribution;
  }

  async checkAndScalePool(): Promise<{
    needsMoreKeys: boolean;
    currentUtilization: number;
    recommendation: string;
  }> {
    const pool = await this.getPoolAllocation(true);
    const utilization = pool.totalCapacity > 0 
      ? (pool.usedCapacity / pool.totalCapacity) * 100 
      : 100;

    let needsMoreKeys = false;
    let recommendation = "Pool is healthy";

    if (utilization > 80) {
      needsMoreKeys = true;
      recommendation = `High utilization (${utilization.toFixed(1)}%). Add more API keys.`;
    } else if (utilization > 60) {
      recommendation = `Moderate utilization (${utilization.toFixed(1)}%). Consider adding more keys soon.`;
    }

    if (pool.websocketKeys.length < 2) {
      needsMoreKeys = true;
      recommendation = "Only 1 WebSocket key. Add backup keys for redundancy.";
    }

    if (!pool.analysisKey) {
      recommendation = "No dedicated Analysis key. Charts may compete with live data.";
    }

    return { needsMoreKeys, currentUtilization: utilization, recommendation };
  }

  async getDecryptedCredentials(configId: string): Promise<{
    apiKey: string;
    apiSecret: string;
    accessToken: string | null;
  } | null> {
    const { data: config } = await supabaseAdmin
      .from("admin_zerodha_configs")
      .select("api_key, api_secret, access_token")
      .eq("id", configId)
      .single();

    if (!config) return null;

    return {
      apiKey: decrypt(config.api_key),
      apiSecret: decrypt(config.api_secret),
      accessToken: config.access_token ? decrypt(config.access_token) : null,
    };
  }

  async getPoolStatus(): Promise<{
    totalKeys: number;
    activeKeys: number;
    analysisKey: { id: string; name: string } | null;
    websocketKeys: { id: string; name: string; instruments: number }[];
    generalKeys: { id: string; name: string }[];
    totalCapacity: number;
    usedCapacity: number;
    healthStatus: string;
  }> {
    const pool = await this.getPoolAllocation(true);
    const allKeys = await this.getAllActiveKeys();
    const health = await this.checkAndScalePool();

    return {
      totalKeys: allKeys.length,
      activeKeys: pool.websocketKeys.length + pool.generalKeys.length + (pool.analysisKey ? 1 : 0),
      analysisKey: pool.analysisKey ? { id: pool.analysisKey.id, name: pool.analysisKey.name } : null,
      websocketKeys: pool.websocketKeys.map(k => ({
        id: k.id,
        name: k.name,
        instruments: k.websocket_instruments_count || 0,
      })),
      generalKeys: pool.generalKeys.map(k => ({ id: k.id, name: k.name })),
      totalCapacity: pool.totalCapacity,
      usedCapacity: pool.usedCapacity,
      healthStatus: health.recommendation,
    };
  }
}

export const apiKeyPoolManager = ApiKeyPoolManager.getInstance();
