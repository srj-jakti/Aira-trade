import { apiKeyPoolManager } from "./api-key-pool-manager";
import { atmStrikeManager } from "./atm-strike-manager";
import { dailySyncManager } from "./daily-instrument-sync";
import { activeTradeManager } from "./active-trade-subscription-manager";
import { supabaseAdmin } from "@/lib/supabase/admin";

export interface CentralDataEngineStatus {
  isHealthy: boolean;
  components: {
    apiKeyPool: {
      status: string;
      totalKeys: number;
      activeKeys: number;
      analysisKeyAvailable: boolean;
      websocketCapacity: number;
      utilization: number;
    };
    atmStrikeMonitor: {
      status: string;
      indicesTracked: number;
      lastShiftTime: string | null;
    };
    dailySync: {
      status: string;
      lastSyncAt: string | null;
      subscribedInstruments: number;
      expiredInstruments: number;
    };
    activeTradeMonitor: {
      status: string;
      activeTrades: number;
      uniqueInstruments: number;
    };
    dataFeed: {
      status: string;
      websocketConnections: number;
      ticksPerSecond: number;
      lastTickAt: string | null;
    };
  };
  warnings: string[];
  recommendations: string[];
}

class CentralDataEngine {
  private static instance: CentralDataEngine;
  private isInitialized = false;
  private startTime: Date | null = null;

  private constructor() {}

  static getInstance(): CentralDataEngine {
    if (!CentralDataEngine.instance) {
      CentralDataEngine.instance = new CentralDataEngine();
    }
    return CentralDataEngine.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log("[CentralDataEngine] Already initialized");
      return;
    }

    console.log("[CentralDataEngine] Initializing all components...");
    this.startTime = new Date();

    try {
      await atmStrikeManager.start();
      await activeTradeManager.start();
      
      this.isInitialized = true;
      console.log("[CentralDataEngine] All components initialized successfully");
    } catch (error) {
      console.error("[CentralDataEngine] Initialization error:", error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    console.log("[CentralDataEngine] Shutting down...");
    
    atmStrikeManager.stop();
    activeTradeManager.stop();
    
    this.isInitialized = false;
    console.log("[CentralDataEngine] Shutdown complete");
  }

  async getComprehensiveStatus(): Promise<CentralDataEngineStatus> {
    const warnings: string[] = [];
    const recommendations: string[] = [];

    const poolStatus = await apiKeyPoolManager.getPoolStatus();
    const poolHealth = await apiKeyPoolManager.checkAndScalePool();
    
    if (poolHealth.needsMoreKeys) {
      warnings.push("API key pool capacity is low");
      recommendations.push(poolHealth.recommendation);
    }

    const atmTrackers = await atmStrikeManager.getTrackerStatus();
    let lastShiftTime: string | null = null;
    for (const tracker of atmTrackers) {
      if (tracker.currentPrice === 0) {
        warnings.push(`${tracker.indexName} has no price data`);
      }
    }

    const { data: atmData } = await supabaseAdmin
      .from("atm_strike_tracker")
      .select("last_shift_at")
      .order("last_shift_at", { ascending: false })
      .limit(1);
    
    if (atmData?.[0]?.last_shift_at) {
      lastShiftTime = atmData[0].last_shift_at;
    }

    const syncStatus = await dailySyncManager.getSyncStatus();
    if (syncStatus.expiredCount > 1000) {
      warnings.push(`${syncStatus.expiredCount} expired instruments in database`);
      recommendations.push("Run daily sync to clean up expired instruments");
    }

    const tradeStats = await activeTradeManager.getActiveTradeStats();

    const { data: engineStatus } = await supabaseAdmin
      .from("data_engine_status")
      .select("*")
      .eq("engine_type", "market_data")
      .single();

    const dataFeedStatus = {
      status: engineStatus?.status || "unknown",
      websocketConnections: poolStatus.websocketKeys.length,
      ticksPerSecond: engineStatus?.ticks_per_second || 0,
      lastTickAt: engineStatus?.last_tick_at || null,
    };

    if (dataFeedStatus.ticksPerSecond === 0 && this.isMarketHours()) {
      warnings.push("No market data ticks received during market hours");
      recommendations.push("Check WebSocket connections and API key validity");
    }

    const isHealthy = warnings.length === 0 && 
      poolStatus.activeKeys > 0 && 
      syncStatus.subscribedCount > 0;

    return {
      isHealthy,
      components: {
        apiKeyPool: {
          status: poolStatus.activeKeys > 0 ? "healthy" : "critical",
          totalKeys: poolStatus.totalKeys,
          activeKeys: poolStatus.activeKeys,
          analysisKeyAvailable: !!poolStatus.analysisKey,
          websocketCapacity: poolStatus.totalCapacity,
          utilization: poolHealth.currentUtilization,
        },
        atmStrikeMonitor: {
          status: atmTrackers.length > 0 ? "running" : "stopped",
          indicesTracked: atmTrackers.length,
          lastShiftTime,
        },
        dailySync: {
          status: syncStatus.isSyncing ? "syncing" : "idle",
          lastSyncAt: syncStatus.lastSyncAt?.toISOString() || null,
          subscribedInstruments: syncStatus.subscribedCount,
          expiredInstruments: syncStatus.expiredCount,
        },
        activeTradeMonitor: {
          status: "running",
          activeTrades: tradeStats.totalActiveTrades,
          uniqueInstruments: tradeStats.uniqueInstruments,
        },
        dataFeed: dataFeedStatus,
      },
      warnings,
      recommendations,
    };
  }

  private isMarketHours(): boolean {
    const now = new Date();
    const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const hours = ist.getHours();
    const minutes = ist.getMinutes();
    const day = ist.getDay();

    if (day === 0 || day === 6) return false;
    
    const currentMinutes = hours * 60 + minutes;
    const marketOpen = 9 * 60 + 15;
    const marketClose = 15 * 60 + 30;

    return currentMinutes >= marketOpen && currentMinutes <= marketClose;
  }

  async triggerDailySync(): Promise<{ success: boolean; message: string }> {
    const result = await dailySyncManager.performDailySync();
    return { success: result.success, message: result.message };
  }

  async refreshAtmSubscriptions(): Promise<void> {
    await atmStrikeManager.forceRefresh();
  }

  async getDataFlowArchitecture(): Promise<{
    overview: string;
    dataFlow: {
      source: string;
      target: string;
      description: string;
      frequency: string;
    }[];
    componentDependencies: Record<string, string[]>;
  }> {
    return {
      overview: `
AIRA TRADING - CENTRAL DATA ENGINE ARCHITECTURE
================================================

                    ┌─────────────────────────────────────┐
                    │         ZERODHA KITE API            │
                    │  (Instruments, Historical, WebSocket)│
                    └──────────────┬──────────────────────┘
                                   │
                    ┌──────────────▼──────────────────────┐
                    │       API KEY POOL MANAGER          │
                    │  ┌─────────┐ ┌─────────┐ ┌────────┐ │
                    │  │Analysis │ │WebSocket│ │General │ │
                    │  │  Key    │ │  Keys   │ │  Keys  │ │
                    │  └────┬────┘ └────┬────┘ └────┬───┘ │
                    └───────┼───────────┼──────────┼──────┘
                            │           │          │
        ┌───────────────────┼───────────┼──────────┼─────────────────┐
        │                   │           │          │                 │
        ▼                   ▼           ▼          ▼                 │
┌───────────────┐   ┌───────────────┐  ┌─────────────────┐          │
│ ANALYSIS PAGE │   │ MARKET DATA   │  │ DAILY SYNC      │          │
│ (Chart Data)  │   │ WORKER        │  │ MANAGER         │          │
│ - Historical  │   │ - WebSocket   │  │ - Instrument    │          │
│ - On-demand   │   │ - Live Ticks  │  │   Refresh       │          │
│ - Dedicated   │   │ - Candle Agg  │  │ - Expiry Clean  │          │
│   API Key     │   │               │  │ - Option Chain  │          │
└───────────────┘   └───────┬───────┘  └─────────────────┘          │
                            │                                        │
                            ▼                                        │
                    ┌───────────────────────────────────┐            │
                    │          SUPABASE DATABASE        │            │
                    │  ┌─────────────┐ ┌─────────────┐  │            │
                    │  │ instruments │ │realtime_ticks│ │            │
                    │  │ (is_subscr) │ │             │  │            │
                    │  └──────┬──────┘ └──────┬──────┘  │            │
                    │         │               │         │            │
                    │  ┌──────▼──────┐ ┌──────▼──────┐  │            │
                    │  │live_candles │ │historical_  │  │            │
                    │  │ (1m,5m,15m) │ │candles      │  │            │
                    │  └──────┬──────┘ └─────────────┘  │            │
                    └─────────┼─────────────────────────┘            │
                              │                                      │
        ┌─────────────────────┼─────────────────────────────────────┐
        │                     │                                     │
        ▼                     ▼                     ▼                │
┌───────────────┐     ┌───────────────┐     ┌───────────────┐       │
│ ATM STRIKE    │     │ SCANNER PAGE  │     │ AI TRADING    │       │
│ MANAGER       │     │ - Pattern     │     │ ENGINE        │       │
│ - 5 Indices   │     │   Detection   │     │ - Strategy    │       │
│ - Auto-shift  │     │ - Live Scan   │     │   Execution   │       │
│ - 20 CE/PE    │     │               │     │ - Auto Entry  │       │
└───────────────┘     └───────────────┘     └───────────────┘       │
                                                    │                │
                                                    ▼                │
                                            ┌───────────────┐       │
                                            │ ACTIVE TRADE  │       │
                                            │ MANAGER       │       │
                                            │ - Force Sub   │       │
                                            │ - Full Mode   │       │
                                            │ - PnL Track   │       │
                                            └───────────────┘       │
      `,
      dataFlow: [
        {
          source: "Zerodha API",
          target: "API Key Pool Manager",
          description: "All API requests routed through pool manager for load balancing",
          frequency: "On-demand",
        },
        {
          source: "API Key Pool Manager",
          target: "Analysis Page",
          description: "Dedicated analysis key for chart/historical data requests",
          frequency: "User-triggered",
        },
        {
          source: "API Key Pool Manager",
          target: "Market Data Worker (Railway)",
          description: "WebSocket keys for real-time tick streaming",
          frequency: "Continuous (market hours)",
        },
        {
          source: "Market Data Worker",
          target: "realtime_ticks table",
          description: "Live tick data storage",
          frequency: "Every tick (~100-500/sec)",
        },
        {
          source: "Market Data Worker",
          target: "live_candles table",
          description: "1m, 5m, 15m candle aggregation",
          frequency: "Every minute",
        },
        {
          source: "Daily Sync Manager",
          target: "instruments table",
          description: "Full instrument list refresh, expiry cleanup",
          frequency: "Daily at 8:00 AM IST",
        },
        {
          source: "ATM Strike Manager",
          target: "instruments table (is_subscribed)",
          description: "Auto-subscribe/unsubscribe based on ATM shifts",
          frequency: "Every 5 seconds",
        },
        {
          source: "live_candles table",
          target: "Scanner Page",
          description: "Pattern scanning on live candles",
          frequency: "User-configured intervals",
        },
        {
          source: "live_candles table",
          target: "AI Trading Engine",
          description: "Strategy evaluation and signal generation",
          frequency: "Per candle close",
        },
        {
          source: "AI Trading Engine",
          target: "Active Trade Manager",
          description: "Register new trades for guaranteed data feed",
          frequency: "On trade entry",
        },
        {
          source: "Active Trade Manager",
          target: "instruments table",
          description: "Force FULL mode subscription for trade instruments",
          frequency: "On trade entry + every 30 seconds",
        },
      ],
      componentDependencies: {
        "Analysis Page": ["API Key Pool Manager", "historical_candles", "instruments"],
        "Scanner Page": ["live_candles", "instruments", "User Risk Settings"],
        "Strategy Page": ["live_candles", "historical_candles", "Strategy Configs"],
        "AI Trading Engine": ["live_candles", "Strategy Configs", "Active Trade Manager"],
        "ATM Strike Manager": ["realtime_ticks", "instruments", "atm_strike_tracker"],
        "Daily Sync Manager": ["API Key Pool Manager", "instruments", "ATM Strike Manager"],
        "Active Trade Manager": ["instruments", "active_trade_instruments"],
        "Market Data Worker": ["API Key Pool Manager", "instruments", "realtime_ticks", "live_candles"],
      },
    };
  }
}

export const centralDataEngine = CentralDataEngine.getInstance();
