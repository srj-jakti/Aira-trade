import { supabaseAdmin } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/server/encryption";

interface ZerodhaConfig {
  id: string;
  name: string;
  api_key: string;
  api_secret: string;
  access_token: string;
  token_expires_at: string | null;
  connection_status: string;
  is_active: boolean;
  priority: number;
  request_count: number;
}

class ZerodhaService {
  private configs: ZerodhaConfig[] = [];
  private lastRefresh = 0;
  private refreshInterval = 30000;
  private currentIndex = 0;

  async getActiveConfig(): Promise<{ apiKey: string; accessToken: string; configId: string } | null> {
    await this.refreshIfNeeded();

    const validConfigs = this.configs.filter(c => {
      if (!c.is_active || !c.access_token) return false;
      if (c.token_expires_at && new Date(c.token_expires_at) < new Date()) return false;
      return true;
    });

    if (validConfigs.length === 0) {
      console.warn("[ZerodhaService] No valid configs with active tokens");
      return null;
    }

    const config = validConfigs[this.currentIndex % validConfigs.length];
    this.currentIndex++;

    try {
      return {
        apiKey: decrypt(config.api_key),
        accessToken: decrypt(config.access_token),
        configId: config.id,
      };
    } catch (e) {
      console.error("[ZerodhaService] Failed to decrypt config:", e);
      return null;
    }
  }

  async getAllActiveConfigs(): Promise<Array<{ apiKey: string; accessToken: string; configId: string; name: string }>> {
    await this.refreshIfNeeded();

    const results: Array<{ apiKey: string; accessToken: string; configId: string; name: string }> = [];

    for (const config of this.configs) {
      if (!config.is_active || !config.access_token) continue;
      if (config.token_expires_at && new Date(config.token_expires_at) < new Date()) continue;

      try {
        results.push({
          apiKey: decrypt(config.api_key),
          accessToken: decrypt(config.access_token),
          configId: config.id,
          name: config.name,
        });
      } catch (e) {
        console.error(`[ZerodhaService] Failed to decrypt config ${config.name}:`, e);
      }
    }

    return results;
  }

  private async refreshIfNeeded(): Promise<void> {
    if (Date.now() - this.lastRefresh < this.refreshInterval && this.configs.length > 0) {
      return;
    }

    const { data, error } = await supabaseAdmin
      .from("admin_zerodha_configs")
      .select("id, name, api_key, api_secret, access_token, token_expires_at, connection_status, is_active, priority, request_count")
      .eq("is_active", true)
      .order("priority", { ascending: true });

    if (error) {
      console.error("[ZerodhaService] Error fetching configs:", error);
      return;
    }

    this.configs = (data || []).map(c => ({
      ...c,
      priority: c.priority || 1,
      request_count: c.request_count || 0,
    }));

    this.lastRefresh = Date.now();
    console.log(`[ZerodhaService] Loaded ${this.configs.length} configs`);
  }

  async trackRequest(configId: string): Promise<void> {
    await supabaseAdmin
      .from("admin_zerodha_configs")
      .update({ 
        request_count: (this.configs.find(c => c.id === configId)?.request_count || 0) + 1,
        last_request_at: new Date().toISOString()
      })
      .eq("id", configId);
  }

  async getStatus(): Promise<{
    totalConfigs: number;
    activeConfigs: number;
    expiredConfigs: number;
  }> {
    await this.refreshIfNeeded();

    const now = new Date();
    const active = this.configs.filter(c => {
      if (!c.is_active || !c.access_token) return false;
      if (c.token_expires_at && new Date(c.token_expires_at) < now) return false;
      return true;
    });

    const expired = this.configs.filter(c => {
      if (!c.access_token) return true;
      if (c.token_expires_at && new Date(c.token_expires_at) < now) return true;
      return false;
    });

    return {
      totalConfigs: this.configs.length,
      activeConfigs: active.length,
      expiredConfigs: expired.length,
    };
  }

  async executeWithConfig<T>(
    fn: (apiKey: string, accessToken: string) => Promise<T>
  ): Promise<T> {
    const config = await this.getActiveConfig();
    
    if (!config) {
      throw new Error("No active Zerodha configurations. Please login first.");
    }

    try {
      const result = await fn(config.apiKey, config.accessToken);
      await this.trackRequest(config.configId);
      return result;
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      if (err.status === 403 || err.message?.includes("Invalid token")) {
        await supabaseAdmin
          .from("admin_zerodha_configs")
          .update({ connection_status: "expired", last_error: "Token expired or invalid" })
          .eq("id", config.configId);
        
        this.lastRefresh = 0;
      }
      throw error;
    }
  }

  clearCache(): void {
    this.lastRefresh = 0;
  }
}

export const zerodhaService = new ZerodhaService();
