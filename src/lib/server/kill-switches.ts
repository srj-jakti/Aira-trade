/**
 * GLOBAL KILL SWITCHES & SYSTEM FLAGS
 * Database-backed feature flags for instant system-wide control
 */

import { supabaseAdmin } from "@/lib/supabase/admin";

export interface SystemFlags {
  DISABLE_MARKET_DATA: boolean;
  DISABLE_SCANNER: boolean;
  DISABLE_TRADING: boolean;
  MAINTENANCE_MODE: boolean;
}

const DEFAULT_FLAGS: SystemFlags = {
  DISABLE_MARKET_DATA: false,
  DISABLE_SCANNER: false,
  DISABLE_TRADING: false,
  MAINTENANCE_MODE: false,
};

class KillSwitchManager {
  private static instance: KillSwitchManager;
  private flags: SystemFlags = { ...DEFAULT_FLAGS };
  private lastRefresh: number = 0;
  private refreshInterval: number = 5000;
  private isInitialized: boolean = false;

  private constructor() {}

  static getInstance(): KillSwitchManager {
    if (!KillSwitchManager.instance) {
      KillSwitchManager.instance = new KillSwitchManager();
    }
    return KillSwitchManager.instance;
  }

  async initialize(): Promise<void> {
    await this.refreshFlags();
    this.isInitialized = true;
  }

  async refreshFlags(): Promise<void> {
    try {
      const { data, error } = await supabaseAdmin
        .from("system_flags")
        .select("flag_name, flag_value, updated_at")
        .in("flag_name", Object.keys(DEFAULT_FLAGS));

      if (error) {
        console.error("[KillSwitch] Error fetching flags:", error);
        return;
      }

      for (const row of data || []) {
        const flagName = row.flag_name as keyof SystemFlags;
        if (flagName in DEFAULT_FLAGS) {
          this.flags[flagName] = row.flag_value === true || row.flag_value === "true";
        }
      }

      this.lastRefresh = Date.now();
    } catch (error) {
      console.error("[KillSwitch] Refresh error:", error);
    }
  }

  private async ensureFresh(): Promise<void> {
    if (Date.now() - this.lastRefresh > this.refreshInterval) {
      await this.refreshFlags();
    }
  }

  async isMarketDataEnabled(): Promise<boolean> {
    await this.ensureFresh();
    return !this.flags.DISABLE_MARKET_DATA && !this.flags.MAINTENANCE_MODE;
  }

  async isScannerEnabled(): Promise<boolean> {
    await this.ensureFresh();
    return !this.flags.DISABLE_SCANNER && !this.flags.MAINTENANCE_MODE;
  }

  async isTradingEnabled(): Promise<boolean> {
    await this.ensureFresh();
    return !this.flags.DISABLE_TRADING && !this.flags.MAINTENANCE_MODE;
  }

  async isInMaintenanceMode(): Promise<boolean> {
    await this.ensureFresh();
    return this.flags.MAINTENANCE_MODE;
  }

  async setFlag(flagName: keyof SystemFlags, value: boolean, reason?: string): Promise<boolean> {
    try {
      const { error } = await supabaseAdmin
        .from("system_flags")
        .upsert({
          flag_name: flagName,
          flag_value: value,
          updated_at: new Date().toISOString(),
          updated_by: "system",
          reason: reason || null,
        }, { onConflict: "flag_name" });

      if (error) {
        console.error("[KillSwitch] Error setting flag:", error);
        return false;
      }

      this.flags[flagName] = value;

      await supabaseAdmin.from("system_health_logs").insert({
        metric_type: "kill_switch_change",
        metric_value: { flag: flagName, value, reason },
        severity: value ? "warning" : "info",
        message: `Kill switch ${flagName} set to ${value}${reason ? `: ${reason}` : ""}`,
      });

      console.log(`[KillSwitch] ${flagName} set to ${value}${reason ? ` (${reason})` : ""}`);
      return true;
    } catch (error) {
      console.error("[KillSwitch] setFlag error:", error);
      return false;
    }
  }

  async disableAllTrading(reason: string): Promise<void> {
    await this.setFlag("DISABLE_TRADING", true, reason);
  }

  async disableMarketData(reason: string): Promise<void> {
    await this.setFlag("DISABLE_MARKET_DATA", true, reason);
  }

  async disableScanner(reason: string): Promise<void> {
    await this.setFlag("DISABLE_SCANNER", true, reason);
  }

  getFlags(): SystemFlags {
    return { ...this.flags };
  }

  async getStatus(): Promise<{
    flags: SystemFlags;
    lastRefresh: number;
    isHealthy: boolean;
  }> {
    await this.ensureFresh();
    
    return {
      flags: { ...this.flags },
      lastRefresh: this.lastRefresh,
      isHealthy: !this.flags.MAINTENANCE_MODE,
    };
  }
}

export const killSwitchManager = KillSwitchManager.getInstance();

export async function checkKillSwitch(
  type: "market_data" | "scanner" | "trading"
): Promise<{ allowed: boolean; reason?: string }> {
  const status = await killSwitchManager.getStatus();

  if (status.flags.MAINTENANCE_MODE) {
    return { allowed: false, reason: "System is in maintenance mode" };
  }

  switch (type) {
    case "market_data":
      if (status.flags.DISABLE_MARKET_DATA) {
        return { allowed: false, reason: "Market data is currently disabled" };
      }
      break;
    case "scanner":
      if (status.flags.DISABLE_SCANNER) {
        return { allowed: false, reason: "Scanner is currently disabled" };
      }
      break;
    case "trading":
      if (status.flags.DISABLE_TRADING) {
        return { allowed: false, reason: "Trading is currently disabled" };
      }
      break;
  }

  return { allowed: true };
}

export async function emergencyStopTrading(reason: string): Promise<void> {
  await killSwitchManager.disableAllTrading(reason);
}
