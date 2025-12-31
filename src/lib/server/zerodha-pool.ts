import { supabaseAdmin } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/server/encryption";

interface ZerodhaConfig {
  id: string;
  name: string;
  api_key: string;
  api_secret: string;
  access_token: string;
  connection_status: string;
  is_active: boolean;
  priority: number;
  current_load: number;
  max_concurrent_requests: number;
}

class AdminZerodhaPool {
  private configs: ZerodhaConfig[] = [];
  private lastRefresh: number = 0;
  private refreshInterval: number = 60000;

  async getActiveConfig(): Promise<{ apiKey: string; accessToken: string; configId: string } | null> {
    await this.refreshIfNeeded();

    const available = this.configs
      .filter(c => 
        c.connection_status === "connected" && 
        c.is_active && 
        c.access_token &&
        c.current_load < c.max_concurrent_requests
      )
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.current_load - b.current_load;
      });

    if (available.length === 0) {
      console.warn("[Zerodha Pool] No available configs");
      return null;
    }

    const selected = available[0];
    
    await this.incrementLoad(selected.id);

    return {
      apiKey: decrypt(selected.api_key),
      accessToken: decrypt(selected.access_token),
      configId: selected.id,
    };
  }

  async releaseConfig(configId: string): Promise<void> {
    await supabaseAdmin.rpc("decrement_zerodha_load", { config_id: configId }).catch(() => {
      supabaseAdmin
        .from("admin_zerodha_configs")
        .update({ 
          current_load: Math.max(0, (this.configs.find(c => c.id === configId)?.current_load || 1) - 1)
        })
        .eq("id", configId);
    });
    
    const config = this.configs.find(c => c.id === configId);
    if (config) {
      config.current_load = Math.max(0, config.current_load - 1);
    }
  }

  private async incrementLoad(configId: string): Promise<void> {
    await supabaseAdmin.rpc("increment_zerodha_load", { config_id: configId }).catch(() => {
      supabaseAdmin
        .from("admin_zerodha_configs")
        .update({ 
          current_load: (this.configs.find(c => c.id === configId)?.current_load || 0) + 1
        })
        .eq("id", configId);
    });
    
    const config = this.configs.find(c => c.id === configId);
    if (config) {
      config.current_load += 1;
    }
  }

  private async refreshIfNeeded(): Promise<void> {
    if (Date.now() - this.lastRefresh < this.refreshInterval && this.configs.length > 0) {
      return;
    }

    const { data, error } = await supabaseAdmin
      .from("admin_zerodha_configs")
      .select("id, name, api_key, api_secret, access_token, connection_status, is_active, priority, current_load, max_concurrent_requests")
      .eq("is_active", true)
      .order("priority", { ascending: true });

    if (error) {
      console.error("[Zerodha Pool] Error fetching configs:", error);
      return;
    }

    this.configs = (data || []).map(c => ({
      ...c,
      priority: c.priority || 1,
      current_load: c.current_load || 0,
      max_concurrent_requests: c.max_concurrent_requests || 10,
    }));

    this.lastRefresh = Date.now();
    console.log(`[Zerodha Pool] Refreshed ${this.configs.length} configs`);
  }

  async getStatus(): Promise<{
    totalConfigs: number;
    connectedConfigs: number;
    totalCapacity: number;
    currentLoad: number;
  }> {
    await this.refreshIfNeeded();

    const connected = this.configs.filter(c => c.connection_status === "connected" && c.is_active);

    return {
      totalConfigs: this.configs.length,
      connectedConfigs: connected.length,
      totalCapacity: connected.reduce((sum, c) => sum + c.max_concurrent_requests, 0),
      currentLoad: connected.reduce((sum, c) => sum + c.current_load, 0),
    };
  }

  async executeWithConfig<T>(
    fn: (apiKey: string, accessToken: string) => Promise<T>
  ): Promise<T> {
    const config = await this.getActiveConfig();
    
    if (!config) {
      throw new Error("No available Zerodha configurations");
    }

    try {
      const result = await fn(config.apiKey, config.accessToken);
      return result;
    } finally {
      await this.releaseConfig(config.configId);
    }
  }
}

export const adminZerodhaPool = new AdminZerodhaPool();
