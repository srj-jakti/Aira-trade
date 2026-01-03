import { supabaseAdmin } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/server/encryption";
import crypto from "crypto";

export interface AIConfig {
  id: string;
  provider: string;
  model: string;
  api_key: string;
  is_active: boolean;
  is_default: boolean;
  priority: number;
}

export interface AIAnalysisResult {
  success: boolean;
  result?: unknown;
  error?: string;
  provider?: string;
  model?: string;
  cached?: boolean;
  tokensUsed?: number;
}

export interface MarketAnalysisInput {
  symbol: string;
  candles: Array<{
    timestamp: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
  indicators?: Record<string, number[]>;
}

class AISharedService {
  private static instance: AISharedService;
  private requestQueue: Map<string, Promise<AIAnalysisResult>> = new Map();

  private constructor() {}

  static getInstance(): AISharedService {
    if (!AISharedService.instance) {
      AISharedService.instance = new AISharedService();
    }
    return AISharedService.instance;
  }

  private generateCacheKey(analysisType: string, input: unknown): string {
    const inputStr = JSON.stringify(input);
    const hash = crypto.createHash("sha256").update(inputStr).digest("hex");
    return `${analysisType}:${hash.slice(0, 16)}`;
  }

  async getActiveConfig(): Promise<AIConfig | null> {
    const { data: configs } = await supabaseAdmin
      .from("admin_ai_configs")
      .select("*")
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("priority", { ascending: true })
      .limit(1);

    return configs?.[0] || null;
  }

  async getAllActiveConfigs(): Promise<AIConfig[]> {
    const { data: configs } = await supabaseAdmin
      .from("admin_ai_configs")
      .select("*")
      .eq("is_active", true)
      .order("priority", { ascending: true });

    return configs || [];
  }

  async checkCache(cacheKey: string): Promise<AIAnalysisResult | null> {
    const { data } = await supabaseAdmin
      .from("ai_analysis_cache")
      .select("*")
      .eq("cache_key", cacheKey)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (data) {
      return {
        success: true,
        result: data.result,
        provider: data.ai_provider,
        model: data.ai_model,
        cached: true,
        tokensUsed: 0,
      };
    }
    return null;
  }

  async storeCache(
    cacheKey: string,
    analysisType: string,
    inputHash: string,
    result: unknown,
    provider: string,
    model: string,
    tokensUsed: number,
    ttlMinutes: number = 60
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    
    await supabaseAdmin.from("ai_analysis_cache").upsert({
      cache_key: cacheKey,
      analysis_type: analysisType,
      input_hash: inputHash,
      result,
      ai_provider: provider,
      ai_model: model,
      tokens_used: tokensUsed,
      expires_at: expiresAt.toISOString(),
    }, { onConflict: "cache_key" });
  }

  async logRequest(
    provider: string,
    model: string,
    requestType: string,
    tokensUsed: number,
    latencyMs: number,
    status: "success" | "error",
    errorMessage?: string
  ): Promise<void> {
    await supabaseAdmin.from("ai_request_log").insert({
      provider,
      model,
      request_type: requestType,
      tokens_used: tokensUsed,
      latency_ms: latencyMs,
      status,
      error_message: errorMessage,
    });

    if (status === "success") {
      await supabaseAdmin
        .from("admin_ai_configs")
        .update({
          request_count: supabaseAdmin.rpc("increment_ai_request_count", {}),
          last_request_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("provider", provider)
        .eq("model", model);
    } else {
      await supabaseAdmin
        .from("admin_ai_configs")
        .update({
          error_count: supabaseAdmin.rpc("increment_ai_error_count", {}),
          last_error: errorMessage,
        })
        .eq("provider", provider)
        .eq("model", model);
    }
  }

  async callOpenAI(
    apiKey: string,
    model: string,
    messages: Array<{ role: string; content: string }>,
    maxTokens: number = 1000
  ): Promise<{ result: unknown; tokensUsed: number }> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "OpenAI API error");
    }

    const data = await response.json();
    return {
      result: data.choices[0]?.message?.content,
      tokensUsed: data.usage?.total_tokens || 0,
    };
  }

  async callAnthropic(
    apiKey: string,
    model: string,
    messages: Array<{ role: string; content: string }>,
    maxTokens: number = 1000
  ): Promise<{ result: unknown; tokensUsed: number }> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "Anthropic API error");
    }

    const data = await response.json();
    return {
      result: data.content[0]?.text,
      tokensUsed: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
    };
  }

  async callGoogle(
    apiKey: string,
    model: string,
    messages: Array<{ role: string; content: string }>,
    maxTokens: number = 1000
  ): Promise<{ result: unknown; tokensUsed: number }> {
    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          generationConfig: { maxOutputTokens: maxTokens },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "Google AI API error");
    }

    const data = await response.json();
    return {
      result: data.candidates?.[0]?.content?.parts?.[0]?.text,
      tokensUsed: data.usageMetadata?.totalTokenCount || 0,
    };
  }

  async callGroq(
    apiKey: string,
    model: string,
    messages: Array<{ role: string; content: string }>,
    maxTokens: number = 1000
  ): Promise<{ result: unknown; tokensUsed: number }> {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "Groq API error");
    }

    const data = await response.json();
    return {
      result: data.choices[0]?.message?.content,
      tokensUsed: data.usage?.total_tokens || 0,
    };
  }

  async executeAnalysis(
    analysisType: string,
    messages: Array<{ role: string; content: string }>,
    options: {
      maxTokens?: number;
      cacheTTL?: number;
      skipCache?: boolean;
    } = {}
  ): Promise<AIAnalysisResult> {
    const { maxTokens = 1000, cacheTTL = 60, skipCache = false } = options;

    const cacheKey = this.generateCacheKey(analysisType, messages);

    if (!skipCache) {
      const cached = await this.checkCache(cacheKey);
      if (cached) {
        return cached;
      }
    }

    if (this.requestQueue.has(cacheKey)) {
      return this.requestQueue.get(cacheKey)!;
    }

    const promise = this.executeWithFallback(analysisType, messages, maxTokens, cacheKey, cacheTTL);
    this.requestQueue.set(cacheKey, promise);

    try {
      return await promise;
    } finally {
      this.requestQueue.delete(cacheKey);
    }
  }

  private async executeWithFallback(
    analysisType: string,
    messages: Array<{ role: string; content: string }>,
    maxTokens: number,
    cacheKey: string,
    cacheTTL: number
  ): Promise<AIAnalysisResult> {
    const configs = await this.getAllActiveConfigs();

    for (const config of configs) {
      const startTime = Date.now();
      try {
        const apiKey = decrypt(config.api_key);
        let response: { result: unknown; tokensUsed: number };

        switch (config.provider) {
          case "openai":
            response = await this.callOpenAI(apiKey, config.model, messages, maxTokens);
            break;
          case "anthropic":
            response = await this.callAnthropic(apiKey, config.model, messages, maxTokens);
            break;
          case "google":
            response = await this.callGoogle(apiKey, config.model, messages, maxTokens);
            break;
          case "groq":
            response = await this.callGroq(apiKey, config.model, messages, maxTokens);
            break;
          default:
            continue;
        }

        const latencyMs = Date.now() - startTime;
        await this.logRequest(config.provider, config.model, analysisType, response.tokensUsed, latencyMs, "success");

        await this.storeCache(
          cacheKey,
          analysisType,
          crypto.createHash("sha256").update(JSON.stringify(messages)).digest("hex"),
          response.result,
          config.provider,
          config.model,
          response.tokensUsed,
          cacheTTL
        );

        return {
          success: true,
          result: response.result,
          provider: config.provider,
          model: config.model,
          cached: false,
          tokensUsed: response.tokensUsed,
        };
      } catch (error) {
        const latencyMs = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        await this.logRequest(config.provider, config.model, analysisType, 0, latencyMs, "error", errorMessage);
        console.error(`AI ${config.provider} failed:`, errorMessage);
      }
    }

    return {
      success: false,
      error: "All AI providers failed",
    };
  }

  async analyzeMarketTrend(input: MarketAnalysisInput): Promise<AIAnalysisResult> {
    const recentCandles = input.candles.slice(-50);
    const candlesSummary = recentCandles.map((c) => ({
      t: c.timestamp.toISOString().split("T")[0],
      o: c.open.toFixed(2),
      h: c.high.toFixed(2),
      l: c.low.toFixed(2),
      c: c.close.toFixed(2),
      v: c.volume,
    }));

    const messages = [
      {
        role: "system",
        content: `You are a professional market analyst. Analyze the given market data and provide insights. 
        Respond in JSON format with: { "trend": "bullish|bearish|neutral", "strength": 0-100, "support": number, "resistance": number, "analysis": "brief analysis" }`,
      },
      {
        role: "user",
        content: `Analyze ${input.symbol} with recent price data: ${JSON.stringify(candlesSummary)}`,
      },
    ];

    return this.executeAnalysis("market_trend", messages, { cacheTTL: 30 });
  }

  async generateSignal(input: MarketAnalysisInput): Promise<AIAnalysisResult> {
    const recentCandles = input.candles.slice(-30);
    
    const messages = [
      {
        role: "system",
        content: `You are a trading signal generator. Based on technical analysis, provide trading signals.
        Respond in JSON format with: { "signal": "buy|sell|hold", "confidence": 0-100, "entry": number, "target": number, "stopLoss": number, "reasoning": "brief explanation" }`,
      },
      {
        role: "user",
        content: `Generate trading signal for ${input.symbol}. Recent prices: ${JSON.stringify(
          recentCandles.map((c) => ({ c: c.close, v: c.volume }))
        )}`,
      },
    ];

    return this.executeAnalysis("trading_signal", messages, { cacheTTL: 15 });
  }

  async generateStrategyIdea(): Promise<AIAnalysisResult> {
    const messages = [
      {
        role: "system",
        content: `You are an expert algorithmic trading strategy developer. Your goal is to generate a highly profitable, robust, and detailed intraday trading strategy.
        The strategy should include specific indicators, entry conditions, exit conditions (stop loss, target, trailing SL), and any risk management rules.
        Focus on strategies for liquid instruments like NIFTY, BANKNIFTY, or top blue-chip stocks.
        
        Respond with a clear, concise description of the strategy in plain English that a user can understand. 
        Start immediately with the strategy details. Avoid preamble like "Here is a strategy...".`,
      },
      {
        role: "user",
        content: "Generate a highly profitable intraday trading strategy for liquid Indian markets.",
      },
    ];

    return this.executeAnalysis("strategy_generation", messages, { cacheTTL: 3600 }); // Cache for 1 hour
  }

  async evaluateStrategy(
    strategyRules: unknown,
    backtestResults: unknown
  ): Promise<AIAnalysisResult> {
    const messages = [
      {
        role: "system",
        content: `You are a trading strategy evaluator. Analyze the strategy rules and backtest results.
        Respond in JSON format with: { "score": 0-100, "strengths": string[], "weaknesses": string[], "suggestions": string[], "riskAssessment": "low|medium|high" }`,
      },
      {
        role: "user",
        content: `Evaluate this strategy: Rules: ${JSON.stringify(strategyRules)}. Results: ${JSON.stringify(backtestResults)}`,
      },
    ];

    return this.executeAnalysis("strategy_evaluation", messages, { cacheTTL: 120 });
  }

  async storeSignal(signal: {
    signalType: string;
    instrumentToken?: number;
    tradingsymbol?: string;
    direction?: string;
    strength?: number;
    confidence?: number;
    analysisData?: unknown;
    aiProvider?: string;
    aiModel?: string;
    expiresInMinutes?: number;
  }): Promise<void> {
    const expiresAt = signal.expiresInMinutes
      ? new Date(Date.now() + signal.expiresInMinutes * 60 * 1000)
      : new Date(Date.now() + 60 * 60 * 1000);

    await supabaseAdmin.from("ai_signals").insert({
      signal_type: signal.signalType,
      instrument_token: signal.instrumentToken,
      tradingsymbol: signal.tradingsymbol,
      direction: signal.direction,
      strength: signal.strength,
      confidence: signal.confidence,
      analysis_data: signal.analysisData,
      ai_provider: signal.aiProvider,
      ai_model: signal.aiModel,
      expires_at: expiresAt.toISOString(),
      is_active: true,
    });
  }

  async getActiveSignals(instrumentToken?: number): Promise<unknown[]> {
    let query = supabaseAdmin
      .from("ai_signals")
      .select("*")
      .eq("is_active", true)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (instrumentToken) {
      query = query.eq("instrument_token", instrumentToken);
    }

    const { data } = await query;
    return data || [];
  }

  async cleanupExpiredCache(): Promise<number> {
    const { data } = await supabaseAdmin
      .from("ai_analysis_cache")
      .delete()
      .lt("expires_at", new Date().toISOString())
      .select("id");

    return data?.length || 0;
  }
}

export const aiSharedService = AISharedService.getInstance();
