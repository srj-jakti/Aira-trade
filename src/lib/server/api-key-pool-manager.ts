import { supabaseAdmin } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/server/encryption";

const MAX_WEBSOCKET_INSTRUMENTS_PER_KEY = 3000;
const ANALYSIS_KEY_ROLE = "analysis";
const TRADING_KEY_ROLE = "trading";
const SCANNER_KEY_ROLE = "scanner";
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
  analysisKeys: ApiKeyConfig[];
  tradingKey: ApiKeyConfig | null;
  scannerKey: ApiKeyConfig | null;
  generalKeys: ApiKeyConfig[];
  totalCapacity: number;
  usedCapacity: number;
}

class ApiKeyPoolManager {
  private static instance: ApiKeyPoolManager;
  private poolCache: PoolAllocation | null = null;
  private lastPoolRefresh: number = 0;
  private readonly POOL_CACHE_TTL = 30000; // 30 seconds

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

    const analysisKeys: ApiKeyConfig[] = [];
    let tradingKey: ApiKeyConfig | null = null;
    let scannerKey: ApiKeyConfig | null = null;
    const generalKeys: ApiKeyConfig[] = [];

    for (const key of keys) {
      if (key.role === ANALYSIS_KEY_ROLE) {
        if (analysisKeys.length < 2) {
          analysisKeys.push(key);
        } else {
          generalKeys.push(key);
        }
      } else if (key.role === TRADING_KEY_ROLE) {
        if (!tradingKey) tradingKey = key;
        else generalKeys.push(key);
      } else if (key.role === SCANNER_KEY_ROLE) {
        if (!scannerKey) scannerKey = key;
        else generalKeys.push(key);
      } else {
        generalKeys.push(key);
      }
    }

    // Auto-assign missing roles from general pool
    if (analysisKeys.length < 2 && generalKeys.length > 0) {
      const needed = 2 - analysisKeys.length;
      for (let i = 0; i < needed && generalKeys.length > 0; i++) {
        const key = generalKeys.shift()!;
        analysisKeys.push(key);
        await this.assignRole(key.id, ANALYSIS_KEY_ROLE);
      }
    }

    if (!tradingKey && generalKeys.length > 0) {
      tradingKey = generalKeys.shift()!;
      await this.assignRole(tradingKey.id, TRADING_KEY_ROLE);
    }

    if (!scannerKey && generalKeys.length > 0) {
      scannerKey = generalKeys.shift()!;
      await this.assignRole(scannerKey.id, SCANNER_KEY_ROLE);
    }

    const totalCapacity = keys.length * MAX_WEBSOCKET_INSTRUMENTS_PER_KEY;
    const usedCapacity = keys.reduce((sum, k) => sum + (k.websocket_instruments_count || 0), 0);

    this.poolCache = {
      analysisKeys,
      tradingKey,
      scannerKey,
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

  async getAnalysisKeys(): Promise<ApiKeyConfig[]> {
    const pool = await this.getPoolAllocation();
    return pool.analysisKeys;
  }

  async getTradingKey(): Promise<ApiKeyConfig | null> {
    const pool = await this.getPoolAllocation();
    return pool.tradingKey || pool.analysisKeys[0] || null;
  }

  async getScannerKey(): Promise<ApiKeyConfig | null> {
    const pool = await this.getPoolAllocation();
    return pool.scannerKey || pool.analysisKeys[1] || pool.tradingKey || null;
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
    const today = new Date().toISOString().split("T")[0];
    await supabaseAdmin.rpc("increment_request_count_with_reset", { 
      config_id: configId,
      today_date: today
    });
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
}

export const apiKeyPoolManager = ApiKeyPoolManager.getInstance();
