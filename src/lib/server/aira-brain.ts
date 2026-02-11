import { supabaseAdmin } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/server/encryption";
import crypto from "crypto";
import { getToolsForAIContext, getRandomArchetype, TRADING_TOOLS } from "@/lib/trading-tools";
import { processZairoth, ZairothResult, applyVolatilityGating, VolatilityContext } from "@/lib/zairoth";

export type BrainState = "IDLE" | "ACTIVE" | "PROCESSING" | "SHUTDOWN";

export interface BrainHeartbeat {
  state: BrainState;
  lastHeartbeat: Date;
  uptime: number;
  requestsProcessed: number;
  errorsCount: number;
  volatility?: VolatilityContext;
}

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

class AiraBrain {
  private static instance: AiraBrain;
  private state: BrainState = "IDLE";
  private startTime: Date | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private requestsProcessed: number = 0;
  private errorsCount: number = 0;
  private volatility: VolatilityContext = { level: "normal" };
  private readonly HEARTBEAT_INTERVAL_MS = 30000;
  private requestQueue: Map<string, Promise<AIAnalysisResult>> = new Map();

  private constructor() {}

  static getInstance(): AiraBrain {
    if (!AiraBrain.instance) {
      AiraBrain.instance = new AiraBrain();
    }
    return AiraBrain.instance;
  }

  async start(): Promise<void> {
    if (this.state !== "IDLE" && this.state !== "SHUTDOWN") {
      console.log("[AiraBrain] Already running");
      return;
    }

    this.state = "ACTIVE";
    this.startTime = new Date();
    this.requestsProcessed = 0;
    this.errorsCount = 0;

    console.log("[AiraBrain] Starting Central AI Engine...");

    this.heartbeatInterval = setInterval(() => {
      this.emitHeartbeat();
    }, this.HEARTBEAT_INTERVAL_MS);

    await this.emitHeartbeat();
    await this.logEvent("BRAIN_START", { startTime: this.startTime.toISOString() });
    console.log("[AiraBrain] Central AI Engine started successfully");
  }

  async stop(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    this.state = "SHUTDOWN";
    console.log("[AiraBrain] Central AI Engine stopped");

    await this.logEvent("BRAIN_SHUTDOWN", { 
      uptime: this.getUptime(),
      requestsProcessed: this.requestsProcessed,
      errorsCount: this.errorsCount
    });
  }

  private async emitHeartbeat(): Promise<void> {
    const heartbeat: BrainHeartbeat = {
      state: this.state,
      lastHeartbeat: new Date(),
      uptime: this.getUptime(),
      requestsProcessed: this.requestsProcessed,
      errorsCount: this.errorsCount,
      volatility: this.volatility,
    };

    try {
      await supabaseAdmin.from("brain_heartbeats").insert({
        state: heartbeat.state,
        uptime_seconds: heartbeat.uptime,
        requests_processed: heartbeat.requestsProcessed,
        errors_count: heartbeat.errorsCount,
        volatility_level: heartbeat.volatility?.level || "normal",
        vix_value: heartbeat.volatility?.vix,
        atr_value: heartbeat.volatility?.atr,
        created_at: heartbeat.lastHeartbeat.toISOString(),
      });
    } catch (error) {
      console.error("[AiraBrain] Heartbeat logging failed:", error);
    }
  }

  private getUptime(): number {
    if (!this.startTime) return 0;
    return Math.floor((Date.now() - this.startTime.getTime()) / 1000);
  }

  getState(): BrainState {
    return this.state;
  }

  getHealth(): BrainHeartbeat {
    return {
      state: this.state,
      lastHeartbeat: new Date(),
      uptime: this.getUptime(),
      requestsProcessed: this.requestsProcessed,
      errorsCount: this.errorsCount,
      volatility: this.volatility,
    };
  }

  setVolatility(level: 'normal' | 'high' | 'extreme', vix?: number, atr?: number): void {
    this.volatility = { level, vix, atr };
    this.logEvent("VOLATILITY_CHANGE", { level, vix, atr });
    this.emitHeartbeat(); // Force heartbeat update on change
  }

  private async logEvent(event: string, details: Record<string, unknown>): Promise<void> {
    try {
      await supabaseAdmin.from("brain_events").insert({
        event_type: event,
        details,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[AiraBrain] Event logging failed:", error);
    }
  }

  isRunning(): boolean {
    return this.state === "ACTIVE" || this.state === "PROCESSING";
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

  async generateEmbedding(text: string): Promise<number[]> {
    const config = await this.getActiveConfig(); // Default to active config, assuming it's OpenAI-compatible
    let targetEmbeddingConfig: AIConfig;
    
    if (!config || config.provider !== 'openai') {
      // If no OpenAI config, we might need a fallback or specific embedding config
      const { data: embeddingConfigs } = await supabaseAdmin
        .from("admin_ai_configs")
        .select("*")
        .eq("provider", "openai")
        .eq("is_active", true)
        .limit(1);
      
      if (!embeddingConfigs?.[0]) throw new Error("No OpenAI config found for embeddings");
      targetEmbeddingConfig = embeddingConfigs[0];
    } else {
      targetEmbeddingConfig = config;
    }

    const apiKey = decrypt(targetEmbeddingConfig.api_key);
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "Embedding API error");
    }

    const data = await response.json();
    return data.data[0].embedding;
  }

  async retrieveSemanticMemory(text: string, userId: string, limit: number = 3): Promise<any[]> {
    try {
      const embedding = await this.generateEmbedding(text);
      const { data, error } = await supabaseAdmin.rpc("match_memory", {
        query_embedding: embedding,
        match_threshold: 0.5,
        match_count: limit,
        p_user_id: userId
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("[AiraBrain] Semantic retrieval failed:", error);
      return [];
    }
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

    this.requestsProcessed++;
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
        this.errorsCount++;
        const latencyMs = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        await this.logRequest(config.provider, config.model, analysisType, 0, latencyMs, "error", errorMessage);
        console.error(`[AiraBrain] AI ${config.provider} failed:`, errorMessage);
      }
    }

    return {
      success: false,
      error: "All AI providers failed",
    };
  }

  async analyzeMarketHumanLike(input: MarketAnalysisInput, timeframe: string): Promise<AIAnalysisResult> {
    const recentCandles = input.candles.slice(-100);
    const candlesSummary = recentCandles.map((c) => ({
      t: c.timestamp instanceof Date ? c.timestamp.toISOString() : c.timestamp,
      o: c.open.toFixed(2),
      h: c.high.toFixed(2),
      l: c.low.toFixed(2),
      c: c.close.toFixed(2),
      v: c.volume,
    }));

    const systemPrompt = `ROLE:
You are a professional discretionary trader with institutional discipline and access to advanced Reinforcement Learning (RL) market models.
Your job is to analyze price charts like a human, augmented by AI/RL intelligence.

You prioritize stability, structure, conviction, and probability over speed.

🔒 CORE NON-NEGOTIABLE RULES
NEVER analyze tick-by-tick
ONLY analyze on CLOSED candles
DO NOT change bias until invalidation
NO trade if confidence < threshold
WAIT is a valid and preferred outcome

  🧠 INSTITUTIONAL & RL-ENGINE PATTERNS (CRITICAL)
  Identify and prioritize:
  - FAIR VALUE GAPS (FVG): Imbalance zones where price moved rapidly.
  - LIQUIDITY SWEEPS: Price grabbing stops above/below old highs/lows before reversal.
  - ORDER BLOCKS: Specific candles where institutions entered.
  - MARKET STRUCTURE SHIFT (MSS): Breaking of minor structure indicating reversal.
  - PREMIUM vs DISCOUNT: Buy only in discount, Sell only in premium zones.
  - RL PREDICTION: Based on recent volatility, the RL engine predicts high-probability expansion zones.

  🧠 ANALYSIS FLOW (MUST FOLLOW IN ORDER)

STEP 1: MARKET REGIME DETECTION
First, classify the market: TRENDING, RANGING, BREAKOUT, CHOP / NO-TRADE.
If regime is CHOP, immediately return: { "state": "WAIT", "reason": "No clear structure" }

STEP 2: MULTI-TIMEFRAME ALIGNMENT
Analyze top-down:
- Higher TF: Direction
- Trading TF: Bias
- Lower TF: Entry quality
RULE: If higher TF ≠ trading TF → WAIT. Only proceed when aligned.

STEP 3: MARKET STRUCTURE (HUMAN + AI THINKING)
Identify: Higher High / Higher Low, Lower High / Lower Low, Range boundaries, Liquidity sweeps, Demand / Supply zones.
Use RL intelligence to determine if a breakout is genuine or a fake-out (liquidity grab).

STEP 4: FORM A SINGLE DIRECTIONAL BIAS
Choose ONLY ONE: BULLISH, BEARISH, NEUTRAL (WAIT).
Once chosen: Bias is LOCKED until invalidation.

STEP 5: ZONE-BASED PREDICTION (PRECISION TARGETS)
Define: Entry Zone, Target Zone, Invalidation Zone.
Ensure Targets and Stop Loss are mathematically sound based on recent ATR and Market Structure.
Example: "entry_zone": [22450, 22470], "target_zone": [22580, 22620], "stoploss_zone": [22380, 22390]

STEP 6: TIME-BOUND CONVICTION
Expected holding time, Expiry. If time expires without progress → invalidate.

STEP 7: CONFIDENCE SCORING (MANDATORY)
Calculate confidence using trend alignment, structure clarity, regime suitability, volatility health, historical success.
If confidence < 0.70 → WAIT. If confidence ≥ 0.70 → PROCEED.

STEP 8: EXPLAINABILITY (RL INSIGHTS)
Always explain WHY (justify the bias) in 2-3 brief technical points, highlighting RL-detected imbalances or structural shifts.

🔐 BIAS LOCK RULE (CRITICAL)
Once analysis is published: Bias, Zones, and Stop are LOCKED.
Invalidate ONLY IF: Candle closes beyond invalidation zone, Market regime changes, or Time expiry reached.

🎯 OUTPUT FORMAT (STRICT JSON)
{
  "state": "WAIT | PREPARE | EXECUTE",
  "market_regime": "string",
  "timeframes": {
    "higher": "string",
    "trading": "string",
    "lower": "string"
  },
  "bias": "BULLISH | BEARISH | NEUTRAL",
  "confidence": 0.00,
  "entry_zone": [min, max],
  "target_zone": [min, max],
  "stoploss_zone": [min, max],
  "time_expectation": "string",
  "analysis_expiry": "string",
  "invalidation_rules": ["string"],
  "technical_summary": ["string"]
}`;



    const messages = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Analyze ${input.symbol} on ${timeframe} timeframe with recent price data (Current Time: ${new Date().toISOString()}): ${JSON.stringify(candlesSummary)}`,
      },
    ];

    return this.executeAnalysis("human_market_analysis", messages, { skipCache: true, maxTokens: 1500 });
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

  async logZairothIntent(
    userInput: string,
    zairoth: string,
    validationResult: unknown,
    compiledJson: unknown,
    outcome: string,
    strategyId?: string
  ): Promise<void> {
    await supabaseAdmin.from("zairoth_intent_logs").insert({
      user_input: userInput,
      generated_zairoth: zairoth,
      validation_result: validationResult,
      compiled_json: compiledJson,
      execution_outcome: outcome,
      strategy_id: strategyId,
    });
  }

  async generateZairothIntent(
    userInput: string,
    context: string = "",
    userId?: string
  ): Promise<AIAnalysisResult & { zairoth?: ZairothResult }> {
    const memories = userId ? await this.retrieveSemanticMemory(userInput, userId) : [];
    const memoryContext = memories.length > 0 
      ? `\n🧠 RELEVANT PAST EXPERIENCES (Read-Only Context):
${memories.map(m => `- ${m.key}: ${JSON.stringify(m.value)}`).join('\n')}
(Use these to avoid past mistakes and follow successful patterns. Never create new intents based on these alone.)`
      : "";

    const systemPrompt = `ROLE:
You are an internal Aira AI intent generator. Your job is to convert user natural language into ZAIROTH v1.0, a deterministic intent DSL.

🧠 ZAIROTH RULES (v1.0)
1. Core Structure: [STATE] [INTENT] [ACTION] [OBJECT] [CONTEXT] [CERTAINTY]
2. State Markers:
RA → Known / factual (past data, confirmed events)
NA → Active / executable now (ready to execute)
VA → Intended / optional (user wants but uncertain)
XA → Prohibited / hard stop (must never happen)
3. Certainty Encoding:
• → low confidence (0.3) - uncertain, needs confirmation
•• → high confidence (0.8) - likely correct
••• → absolute / non-negotiable (1.0) - must be exact
4. Requirements:
- One instruction per line
- No natural language filler
- Use VA if unsure about user intent
- Assign CERTAINTY to EVERY line
- Never use NA with • (dangerous)
- Never use VA with ••• (ambiguous)

VALID INTENTS: trade-buy, trade-sell, signal, market-condition, risk-param, capital-rule, strategy-create, strategy-update, backtest-run
VALID ACTIONS: Lun, condition, alert, set, restrict, create, update, execute

EXAMPLES:
User: "I want to buy Nifty if RSI is below 40"
ZAIROTH:
VA trade-buy Lun NIFTY cond:rsi<40 ••

User: "Create a strategy that sells when price drops below EMA20"
ZAIROTH:
VA strategy-create create momentum cond:price<ema20 ••

User: "Never trade when capital used is above 50%"
ZAIROTH:
XA trade-buy restrict all capital:50 •••
XA trade-sell restrict all capital:50 •••

${context}${memoryContext}

Generate ONLY the ZAIROTH lines. No explanations. No markdown. No code blocks.`;


    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userInput },
    ];

    const result = await this.executeAnalysis("zairoth_generation", messages, {
      maxTokens: 500,
      skipCache: true,
    });

      if (result.success && typeof result.result === "string") {
        try {
          const sanitized = sanitizeZairothText(result.result);
          let zairoth = processZairoth(sanitized);
          
          // Apply Volatility Gating
          const gating = applyVolatilityGating(zairoth.instructions, this.volatility);
          
          await this.logZairothIntent(
            userInput,
            sanitized,
            { 
              ...zairoth.validation, 
              volatility_gating: gating.violations,
              gated_count: zairoth.instructions.length - gating.gatedInstructions.length
            },
            gating.gatedInstructions, // Log gated instructions as canonical if needed, or keeping it as is
            gating.violations.some(v => v.severity === 'error') ? "gated" : "success",
            undefined
          );

            // Update zairoth object with gated instructions
            zairoth = {
              ...zairoth,
              instructions: gating.gatedInstructions as any,
            } as any;
          
          return { ...result, zairoth };
        } catch (error: unknown) {

        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        
        await this.logZairothIntent(
          userInput,
          result.result,
          { error: errorMessage },
          null,
          "validation_failed",
          undefined
        );
        
        return {
          success: false,
          error: `ZAIROTH Validation Failed: ${errorMessage}`,
        };
      }
    }

    return result;
  }

  async generateStrategyIdea(userInput?: string, referenceInstrument?: string): Promise<AIAnalysisResult> {
    const archetype = getRandomArchetype();
    const toolsContext = getToolsForAIContext();
    
    const preferredTools = archetype.preferredIndicators
      .map(id => TRADING_TOOLS.find(t => t.id === id))
      .filter(Boolean)
      .map(t => `${t!.name} (${t!.shortName})`);

    const hasUserInput = userInput && userInput.trim().length > 10;
    
    const systemPrompt = `You are a Senior Quant Developer creating PRACTICAL trading strategies for Indian markets (NSE).

${toolsContext}

${!hasUserInput ? `
STRATEGY ARCHETYPE: ${archetype.name}
Description: ${archetype.description}
Preferred Indicators: ${preferredTools.join(", ")}
` : `
The user has provided their own strategy idea. Convert it into a SIMPLE, actionable strategy.
`}

${referenceInstrument ? `
NOTE: Use ${referenceInstrument} as the reference instrument for signals.
` : ""}

### CRITICAL: GENERATE SIMPLE, TRADEABLE STRATEGIES
1. Use ONLY 1-2 entry conditions - more conditions = fewer signals = worse backtests
2. Use REALISTIC thresholds:
   - RSI oversold: 35-40 (NOT 30)
   - RSI overbought: 60-65 (NOT 70)  
3. Supertrend direction is very reliable
4. EMA crossovers work well
5. AVOID complex patterns (engulfing, hammer) - they rarely trigger

### OUTPUT FORMAT (Plain Text):
Write a clear, actionable strategy in this format:

**Strategy Name**: [Name]
**Description**: [1-2 sentences]

**BUY Entry**: [Simple condition, e.g., "RSI(14) below 40" OR "Price crosses above EMA(20)"]
**SELL Entry**: [Simple condition, e.g., "RSI(14) above 60" OR "Price crosses below EMA(20)"]

**Stop Loss**: [X]% from entry
**Target**: [Y]% from entry

**Timeframe**: 15 minute / Daily
**Best Markets**: Index futures, large cap stocks

Keep it SIMPLE with 1-2 conditions max per entry.`;

    const userPrompt = hasUserInput 
      ? `Convert my idea into a SIMPLE strategy with 1-2 entry conditions:\n\n${userInput}`
      : `Generate a simple, practical ${archetype.name} strategy. Use only 1-2 entry conditions for BUY and SELL.`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    return this.executeAnalysis("strategy_generation", messages, { 
      cacheTTL: hasUserInput ? 1 : 300,
      maxTokens: 1000,
      skipCache: !hasUserInput
    });
  }

  async generateNeuralStrategyIdea(userInput?: string, referenceInstrument?: string): Promise<AIAnalysisResult> {
    const hasUserInput = userInput && userInput.trim().length > 10;
    
    const systemPrompt = `ROLE:
You are a Lead Quant Strategist specializing in Price Action Sequences and Institutional Market Structure.
Your job is to create "Fully AI" strategies that do not rely on lagging indicators, but on the "Soul of the Market."

🧠 NEURAL STRATEGY ARCHITECTURE (PRICE ACTION SEQUENCES)
Your strategies MUST focus on these four pillars:

1. MARKET REGIME & STRUCTURE (The 'Where')
   - Identify Bullish/Bearish structure using HH/HL (Higher Highs/Higher Lows).
   - Define the "Trading Range" (Dealing Range).
   - Only trade in the direction of the higher timeframe structure.

2. LIQUIDITY & FOOTPRINTS (The 'Why')
   - Look for "Liquidity Sweeps" (Price briefly breaking below a support/resistance to grab stops before reversing).
   - Identify "Fair Value Gaps" (FVG) or "Imbalances" where price moved too fast.
   - Wait for "Market Structure Shifts" (MSS) after a liquidity grab.

3. ENTRY SEQUENCES (The 'When')
   - Do NOT say "Buy when RSI < 30."
   - DO say "Wait for a run on Sell-Side Liquidity → Market Structure Shift → Entry at the Fair Value Gap / Order Block."

4. ZONE-BASED MANAGEMENT
   - Entry Zone (Institutional POI - Point of Interest).
   - Invalidation (Logical structure break, not just % based).
   - Targets (External Liquidity zones).

${referenceInstrument ? `NOTE: Use ${referenceInstrument} as the reference instrument for structural analysis.` : ""}

### OUTPUT FORMAT (Plain Text):
Write a clear, actionable Neural Strategy in this format:

**Strategy Name**: [High-Conviction Neural Name]
**Market Thesis**: [1-2 sentences explaining the institutional logic]

**MARKET CONTEXT**: [Explain the structure needed - e.g. "Bullish MSS on 15m after H1 Liquidity Sweep"]
**ENTRY SEQUENCE**: [The step-by-step price action sequence required for entry]
**EXIT LOGIC**: [Structure-based targets and invalidation points]

**Timeframe**: Preferred timeframe for the sequence
**Best Markets**: Where this specific pattern occurs most

Keep it ELITE. Avoid retail indicator talk. Focus on Price Action Sequences.`;

    const userPrompt = hasUserInput 
      ? `Transform my idea into a professional Price Action Sequence strategy:\n\n${userInput}`
      : `Generate a high-probability institutional price action strategy based on Liquidity and Market Structure.`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    return this.executeAnalysis("neural_strategy_generation", messages, { 
      cacheTTL: hasUserInput ? 1 : 300,
      maxTokens: 1200,
      skipCache: !hasUserInput
    });
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

  async refineRLOptimization(
    strategyId: number,
    rlParams: Record<string, any>,
    globalWeights: Record<string, any>
  ): Promise<AIAnalysisResult> {
    const systemPrompt = `ROLE:
You are the Lead Institutional Strategist at Aira. 
Your job is to translate raw mathematical RL optimizations into high-conviction institutional trading logic.

🧠 CONTEXT:
The RL Engine has simulated millions of trades to find these optimal parameters.
The "Global Brain" contains the collective intelligence from all Aira users.

RL PARAMETERS: ${JSON.stringify(rlParams)}
GLOBAL BRAIN WEIGHTS: ${JSON.stringify(globalWeights)}

TASK:
1. Explain the "Institutional Why" behind these parameters.
   - e.g. "The RL engine found SL at 1.2% works best. This aligns with institutional liquidity sweeps often occurring within 1-1.5% of the entry zone."
2. Suggest 1-2 "Human" filters that complement these RL findings (FVG, Order Blocks, MSS).
3. Provide a refined "Thesis" for this strategy version.

OUTPUT FORMAT (JSON):
{
  "institutional_thesis": "string",
  "parameter_justifications": [
    { "param": "string", "reason": "string" }
  ],
  "structural_refinements": [
    { "concept": "string", "implementation": "string" }
  ]
}`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Refine the RL optimization for strategy #${strategyId}` },
    ];

    return this.executeAnalysis("rl_refinement", messages, { maxTokens: 1000 });
  }

  async suggestOptimalTimeframe(
    tf5Result: any,
    tf15Result: any
  ): Promise<AIAnalysisResult> {
    const systemPrompt = `ROLE:
You are an expert intraday trader. Analyze backtest results for two timeframes (5m and 15m) and pick the one that offers the best balance of profitability, risk (Drawdown), and execution stability.

BACKTEST DATA:
5m: ${JSON.stringify(tf5Result)}
15m: ${JSON.stringify(tf15Result)}

INSTRUCTIONS:
1. Recommend the optimal timeframe.
2. Explain WHY (e.g. "15m provides cleaner structure and avoids noise" or "5m captures momentum shifts faster").
3. Suggest if any parameter should change if the user switches timeframe.

OUTPUT FORMAT (JSON):
{
  "recommended_timeframe": "5m | 15m",
  "reasoning": "string",
  "trade_off_analysis": "string",
  "parameter_tweak": "string"
}`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Compare 5m and 15m timeframes and suggest the best one." },
    ];

    return this.executeAnalysis("timeframe_optimization", messages, { maxTokens: 1000 });
  }
}

function sanitizeZairothText(raw: string): string {
  const normalized = raw.replace(/\r\n/g, "\n").trim();
  const lines = normalized
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .filter((l) => !l.startsWith("```"));

  const validPrefix = /^(RA|NA|VA|XA)\s+/;

  const convertCertainty = (line: string): string => {
    if (/\s+•{1,3}$/.test(line)) return line;
    if (/\s+\*{1,3}$/.test(line)) {
      const stars = (line.match(/\*+$/)?.[0] || "*").length;
      const mapped = stars === 1 ? "•" : stars === 2 ? "••" : "•••";
      return line.replace(/\s+\*{1,3}$/, ` ${mapped}`);
    }
    if (line.startsWith("XA ")) return `${line} •••`;
    if (line.startsWith("NA ")) return `${line} ••`;
    return `${line} ••`;
  };

  const filtered = lines.filter((l) => validPrefix.test(l)).map(convertCertainty);
  if (filtered.length > 0) return filtered.join("\n");

  if (validPrefix.test(normalized)) return convertCertainty(normalized);
  return normalized;
}

export const airaBrain = AiraBrain.getInstance();
