import { createClient } from "@supabase/supabase-js";
import { zerodhaService } from "../lib/server/zerodha-service";

type StrategyCategory = 'SCALPING' | 'INTRADAY' | 'SWING' | 'INVESTMENT';

export class StrategistWorker {
  private static instance: StrategistWorker;
  private isRunning = false;
  
  // Different scan intervals for different categories
  private intervals = {
    SCALPING: 60000,      // 1 min
    INTRADAY: 300000,     // 5 min
    SWING: 3600000,       // 1 hour
    INVESTMENT: 86400000, // 1 day
  };

  private supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  private constructor() {}

  static getInstance(): StrategistWorker {
    if (!StrategistWorker.instance) {
      StrategistWorker.instance = new StrategistWorker();
    }
    return StrategistWorker.instance;
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log("[Strategist] Worker Started");

    // Start independent loops for each category
    this.runCategoryLoop('SCALPING');
    this.runCategoryLoop('INTRADAY');
    this.runCategoryLoop('SWING');
    this.runCategoryLoop('INVESTMENT');
  }

  async stop() {
    this.isRunning = false;
    console.log("[Strategist] Worker Stopped");
  }

  private async runCategoryLoop(category: StrategyCategory) {
    console.log(`[Strategist] Started ${category} Loop`);
    while (this.isRunning) {
      try {
        await this.scanStrategies(category);
      } catch (error) {
        console.error(`[Strategist] Error in ${category} loop:`, error);
      }
      await new Promise(r => setTimeout(r, this.intervals[category]));
    }
  }

  private async scanStrategies(category: StrategyCategory) {
    // 1. Fetch active strategies for this category
    const { data: strategies } = await this.supabase
      .from("strategies")
      .select("*")
      .eq("category", category)
      .eq("is_active", true);

    if (!strategies || strategies.length === 0) return;

    // 2. Fetch users interested in this segment (Optimization)
    // Only scan if there are users subscribed to this type of trading
    // const interestedUsers = await this.getInterestedUsers(category);
    // if (interestedUsers.length === 0) return;

    console.log(`[Strategist] Scanning ${strategies.length} ${category} strategies...`);

    for (const strategy of strategies) {
      // 3. Execute Strategy Logic (Mocked)
      // In a real scenario, this would evaluate indicators like SuperTrend/RSI
      const mockSignal = {
        symbol: strategy.instrument_token === 256265 ? "NIFTY 50" : "NIFTY BANK",
        token: strategy.instrument_token,
        type: Math.random() > 0.5 ? "BUY" : "SELL",
        price: 24500,
        time: new Date()
      };

      // 4. Validate with AI Brain (Predictive Check)
      const aiValidation = await this.consultPredictiveBrain(mockSignal.token, category, mockSignal.type);
      
      if (aiValidation.isApproved) {
         console.log(`[Strategist] Signal APPROVED for ${mockSignal.symbol} (${mockSignal.type}) - AI Confidence: ${aiValidation.confidence}%`);
         // this.executeSignal(mockSignal);
      } else {
         console.log(`[Strategist] Signal REJECTED for ${mockSignal.symbol} (${mockSignal.type}) - AI says: ${aiValidation.reason}`);
      }
    }
  }

  private async consultPredictiveBrain(token: number, category: StrategyCategory, signalType: string): Promise<{ isApproved: boolean, confidence: number, reason: string }> {
    // Map Category to Timeframe
    const tfMap = {
        'SCALPING': '1m', // or 3m
        'INTRADAY': '5m', // or 15m
        'SWING': '1h',
        'INVESTMENT': '1d'
    };
    const timeframe = tfMap[category] || '15m';

    // Fetch latest prediction
    const { data: prediction } = await this.supabase
        .from('ai_predictions')
        .select('*')
        .eq('instrument_token', token)
        .eq('timeframe', timeframe)
        .order('prediction_time', { ascending: false })
        .limit(1)
        .single();

    if (!prediction) {
        return { isApproved: true, confidence: 50, reason: "No AI Prediction found, using raw signal" };
    }

    // Check freshness (e.g., within 2x timeframe duration)
    const predTime = new Date(prediction.prediction_time).getTime();
    const now = Date.now();
    // Simple stale check: 1 hour for now
    if ((now - predTime) > 3600000) {
         return { isApproved: true, confidence: 50, reason: "AI Prediction stale, using raw signal" };
    }

    const aiTrend = (prediction.predicted_close > prediction.predicted_open) ? "BUY" : "SELL"; 
    // Wait, predicted_open might not exist. Check predicted_path trend.
    // If predicted_close > current price? We don't have current price here easily.
    // Let's assume predicted_close > predicted_low + (predicted_high - predicted_low)/2 is bullish?
    // Better: use prediction.predicted_close vs prediction.predicted_path[0].price
    
    // Simplification: Check high/low or just trust the 'regime' if I stored it?
    // I stored 'regime_detected' in python script.
    
    // Let's interpret the path
    let pathTrend = "NEUTRAL";
    if (prediction.predicted_path && Array.isArray(prediction.predicted_path) && prediction.predicted_path.length > 0) {
        const start = prediction.predicted_path[0].price;
        const end = prediction.predicted_path[prediction.predicted_path.length - 1].price;
        pathTrend = end > start ? "BUY" : "SELL";
    }

    if (pathTrend === signalType) {
        return { isApproved: true, confidence: prediction.confidence_score, reason: "AI Confirms Trend" };
    } else {
        if (prediction.confidence_score > 80) {
            return { isApproved: false, confidence: prediction.confidence_score, reason: `AI Strong Reversal (${pathTrend}) detected` };
        } else {
            return { isApproved: true, confidence: 40, reason: `AI Divergence but Low Confidence (${prediction.confidence_score}%)` };
        }
    }
  }
}

// Start worker if run directly
if (require.main === module) {
  StrategistWorker.getInstance().start();
}
