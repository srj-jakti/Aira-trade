import { supabaseAdmin } from "@/lib/supabase/admin";
import { aiSharedService } from "./ai-shared-service";
import { marketDataEngine } from "./market-data-engine";
import { decrypt } from "./encryption";

export interface StrategyLogic {
  conditions: string[];
  indicators?: string[];
  parameters?: Record<string, number | string>;
  description?: string;
}

export interface StructuredStrategy {
  name: string;
  description: string;
  strategy_type?: "SWING" | "INTRADAY" | "SCALPING" | "OPTIONS";
  buy_entry_logic: StrategyLogic;
  buy_stop_loss: StrategyLogic;
  buy_target: StrategyLogic;
  buy_trailing_sl: StrategyLogic;
  sell_entry_logic: StrategyLogic;
  sell_stop_loss: StrategyLogic;
  sell_target: StrategyLogic;
  sell_trailing_sl: StrategyLogic;
  hold_logic: StrategyLogic;
}

class StrategyServiceV2 {
  private static instance: StrategyServiceV2;
  private constructor() {}
  static getInstance(): StrategyServiceV2 {
    if (!StrategyServiceV2.instance) StrategyServiceV2.instance = new StrategyServiceV2();
    return StrategyServiceV2.instance;
  }

  async formatStrategyWithAI(rawInput: string, aiAnalysisEnabled: boolean = false): Promise<StructuredStrategy> {
    const messages = [{ role: "system", content: "Expert Professional Trader AI. Format user input into structured JSON." }, { role: "user", content: rawInput }];
    const result = await aiSharedService.executeAnalysis("strategy_format", messages);
    if (!result.success || !result.result) throw new Error("AI failed to format strategy");
    const parsed = typeof result.result === "string" ? JSON.parse(result.result) : result.result;
    return this.sanitize(parsed);
  }

  private sanitize(strategy: any): StructuredStrategy {
    const fields = ["buy_entry_logic", "buy_stop_loss", "buy_target", "buy_trailing_sl", "sell_entry_logic", "sell_stop_loss", "sell_target", "sell_trailing_sl", "hold_logic"];
    fields.forEach(f => { if (!strategy[f]) strategy[f] = { conditions: [] }; });
    if (!strategy.name) strategy.name = "New Strategy";
    if (!strategy.description) strategy.description = "AI Generated";
    return strategy;
  }

  async getUserStrategies(userId: string): Promise<any[]> {
    const { data } = await supabaseAdmin.from("strategies").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    return data || [];
  }
}

export const strategyService = StrategyServiceV2.getInstance();
