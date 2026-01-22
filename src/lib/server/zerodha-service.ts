import { supabaseAdmin } from "@/lib/supabase/admin";
import { decrypt, encrypt } from "@/lib/server/encryption";
import { performZerodhaFullLogin } from "@/lib/server/zerodha-auth";

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
  user_id: string;
  password: string;
  totp_secret: string;
  auto_login_enabled: boolean;
}

class ZerodhaService {
  private configs: ZerodhaConfig[] = [];
  private lastRefresh = 0;
  private refreshInterval = 30000;
  private currentIndex = 0;
  private isAutoLoginRunning = false;

  async getActiveConfig(): Promise<{ apiKey: string; accessToken: string; configId: string } | null> {
    await this.refreshIfNeeded();

    let validConfigs = this.configs.filter(c => {
      if (!c.is_active || !c.access_token) return false;
      if (c.token_expires_at && new Date(c.token_expires_at) < new Date()) return false;
      return true;
    });

    // Self-healing: If no valid configs, check if we can auto-login
    if (validConfigs.length === 0 && !this.isAutoLoginRunning) {
      const autoLoginCandidates = this.configs.filter(c => 
        c.is_active && 
        c.auto_login_enabled && 
        c.api_key && 
        c.api_secret && 
        c.user_id && 
        c.password && 
        c.totp_secret
      );

      if (autoLoginCandidates.length > 0) {
        console.log(`[ZerodhaService] No valid tokens found, but ${autoLoginCandidates.length} accounts have auto-login enabled. Attempting on-demand refresh...`);
        await this.attemptOnDemandAutoLogin(autoLoginCandidates);
        
        // Refresh valid configs after attempt
        validConfigs = this.configs.filter(c => {
          if (!c.is_active || !c.access_token) return false;
          if (c.token_expires_at && new Date(c.token_expires_at) < new Date()) return false;
          return true;
        });
      }
    }

    if (validConfigs.length === 0) {
      console.warn("[ZerodhaService] No valid configs with active tokens (even after self-healing check)");
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

  private async attemptOnDemandAutoLogin(candidates: ZerodhaConfig[]): Promise<void> {
    if (this.isAutoLoginRunning) return;
    this.isAutoLoginRunning = true;

    try {
      for (const config of candidates) {
        console.log(`[ZerodhaService] Self-healing login for: ${config.name}`);
        
        try {
          const result = await performZerodhaFullLogin({
            api_key: decrypt(config.api_key),
            api_secret: decrypt(config.api_secret),
            user_id: decrypt(config.user_id),
            password: decrypt(config.password),
            totp_secret: decrypt(config.totp_secret),
          });

          if (result.success && result.accessToken) {
            const tokenExpiry = new Date();
            tokenExpiry.setHours(23, 59, 59, 999);

            const { error: updateError } = await supabaseAdmin
              .from("admin_zerodha_configs")
              .update({
                access_token: encrypt(result.accessToken),
                token_expires_at: tokenExpiry.toISOString(),
                last_login_at: new Date().toISOString(),
                connection_status: "connected",
                last_error: null,
                updated_at: new Date().toISOString(),
              })
              .eq("id", config.id);

            if (!updateError) {
              console.log(`[ZerodhaService] Self-healing SUCCESS for ${config.name}`);
              await supabaseAdmin.from("zerodha_login_logs").insert({
                config_id: config.id,
                login_type: "scheduled",
                status: "success",
                triggered_by: "on_demand_self_healing",
              });
              
              // Only need one successful login to serve current request
              this.lastRefresh = 0; // Force refresh on next check
              break; 
            }
          } else {
            console.error(`[ZerodhaService] Self-healing FAILED for ${config.name}: ${result.error}`);
            await supabaseAdmin
              .from("admin_zerodha_configs")
              .update({
                connection_status: "error",
                last_error: `Self-healing failed: ${result.error}`,
                updated_at: new Date().toISOString(),
              })
              .eq("id", config.id);
          }
        } catch (err) {
          console.error(`[ZerodhaService] Error in self-healing loop for ${config.name}:`, err);
        }
      }
    } finally {
      this.isAutoLoginRunning = false;
      await this.refreshIfNeeded();
    }
  }

  async getAllActiveConfigs(): Promise<Array<{ apiKey: string; accessToken: string; configId: string; name: string }>> {
    await this.refreshIfNeeded();

    let results: Array<{ apiKey: string; accessToken: string; configId: string; name: string }> = [];

    const processConfigs = () => {
      const res: Array<{ apiKey: string; accessToken: string; configId: string; name: string }> = [];
      for (const config of this.configs) {
        if (!config.is_active || !config.access_token) continue;
        if (config.token_expires_at && new Date(config.token_expires_at) < new Date()) continue;

        try {
          res.push({
            apiKey: decrypt(config.api_key),
            accessToken: decrypt(config.access_token),
            configId: config.id,
            name: config.name,
          });
        } catch (e) {
          console.error(`[ZerodhaService] Failed to decrypt config ${config.name}:`, e);
        }
      }
      return res;
    };

    results = processConfigs();

    // Self-healing check
    if (results.length === 0 && !this.isAutoLoginRunning) {
      const autoLoginCandidates = this.configs.filter(c => c.is_active && c.auto_login_enabled);
      if (autoLoginCandidates.length > 0) {
        await this.attemptOnDemandAutoLogin(autoLoginCandidates);
        results = processConfigs();
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
      .select("id, name, api_key, api_secret, access_token, token_expires_at, connection_status, is_active, priority, request_count, user_id, password, totp_secret, auto_login_enabled")
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
