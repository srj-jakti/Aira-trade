import { supabaseAdmin } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/server/encryption";
import crypto from "crypto";
import { getToolsForAIContext, getRandomArchetype, STRATEGY_ARCHETYPES, TRADING_TOOLS } from "@/lib/trading-tools";

export type { AIConfig, AIAnalysisResult, MarketAnalysisInput };

class AISharedService {
  private static instance: AISharedService;

  private constructor() {}

  static getInstance(): AISharedService {
    if (!AISharedService.instance) {
      AISharedService.instance = new AISharedService();
    }
    return AISharedService.instance;
  }

  async getActiveConfig(): Promise<AIConfig | null> {
    return airaBrain.getActiveConfig();
  }

  async getAllActiveConfigs(): Promise<AIConfig[]> {
    return airaBrain.getAllActiveConfigs();
  }

  async checkCache(cacheKey: string): Promise<AIAnalysisResult | null> {
    return airaBrain.checkCache(cacheKey);
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
    return airaBrain.storeCache(cacheKey, analysisType, inputHash, result, provider, model, tokensUsed, ttlMinutes);
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
    return airaBrain.logRequest(provider, model, requestType, tokensUsed, latencyMs, status, errorMessage);
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
    return airaBrain.executeAnalysis(analysisType, messages, options);
  }

  async analyzeMarketHumanLike(input: MarketAnalysisInput, timeframe: string): Promise<AIAnalysisResult> {
    return airaBrain.analyzeMarketHumanLike(input, timeframe);
  }

  async analyzeMarketTrend(input: MarketAnalysisInput): Promise<AIAnalysisResult> {
    return airaBrain.analyzeMarketTrend(input);
  }

  async generateSignal(input: MarketAnalysisInput): Promise<AIAnalysisResult> {
    return airaBrain.generateSignal(input);
  }

  async logZairothIntent(
    userInput: string,
    zairoth: string,
    validationResult: unknown,
    compiledJson: unknown,
    outcome: string,
    strategyId?: string
  ): Promise<void> {
    return airaBrain.logZairothIntent(userInput, zairoth, validationResult, compiledJson, outcome, strategyId);
  }

  async generateZairothIntent(
    userInput: string,
    context: string = ""
  ): Promise<AIAnalysisResult & { zairoth?: ZairothResult }> {
    return airaBrain.generateZairothIntent(userInput, context);
  }

  async generateStrategyIdea(userInput?: string, referenceInstrument?: string): Promise<AIAnalysisResult> {
    return airaBrain.generateStrategyIdea(userInput, referenceInstrument);
  }

  async generateNeuralStrategyIdea(userInput?: string, referenceInstrument?: string): Promise<AIAnalysisResult> {
    return airaBrain.generateNeuralStrategyIdea(userInput, referenceInstrument);
  }

  async generateStrategyIdea(userInput?: string, referenceInstrument?: string): Promise<AIAnalysisResult> {
    const archetype = getRandomArchetype();
    const toolsContext = getToolsForAIContext();
    
    const preferredTools = archetype.preferredIndicators
      .map(id => TRADING_TOOLS.find(t => t.id === id))
      .filter(Boolean)
      .map(t => `${t!.name} (${t!.shortName})`);
    
    const preferredPatterns = archetype.preferredPatterns
      .map(id => TRADING_TOOLS.find(t => t.id === id))
      .filter(Boolean)
      .map(t => `${t!.name}`);

    const hasUserInput = userInput && userInput.trim().length > 10;
    
    const systemPrompt = `You are an expert algorithmic trading strategy developer specializing in Indian markets (NSE/BSE).
Your goal is to generate highly profitable, robust, and detailed intraday/swing trading strategies.

${toolsContext}

${!hasUserInput ? `
STRATEGY ARCHETYPE FOR THIS GENERATION: ${archetype.name}
Description: ${archetype.description}
Preferred Indicators: ${preferredTools.join(", ")}
Preferred Patterns: ${preferredPatterns.join(", ")}

Generate a unique strategy based on this archetype. Be creative and specific.
` : `
The user has provided their own strategy idea. Enhance it with specific indicators, entry/exit rules, and risk management.
`}

${referenceInstrument ? `
IMPORTANT: The user wants to trade derivatives but use ${referenceInstrument} as a reference for signals.
Include logic for how to use the ${referenceInstrument} price/signals to trigger entries on the actual trading instrument.
` : ""}

STRATEGY REQUIREMENTS:
1. Specify the instrument type (Index, Stock, F&O) and recommended symbols
2. Timeframe for analysis (1min, 5min, 15min, etc.)
3. ENTRY CONDITIONS: Use specific indicators with exact parameters (e.g., "RSI(14) crosses above 30")
4. EXIT CONDITIONS: 
   - Stop Loss: Fixed points/percentage OR ATR-based
   - Target: Fixed OR trailing OR indicator-based
   - Time-based exit if applicable
5. Position sizing recommendation
6. Best market conditions for this strategy
7. Risk management rules

Write in clear, actionable plain English. Start directly with the strategy - no preamble.
Each condition should be specific enough to be coded into an algorithm.`;

    const userPrompt = hasUserInput 
      ? `Based on my idea below, create a complete, detailed trading strategy with specific rules:\n\n${userInput}`
      : `Generate a unique, highly profitable ${archetype.name} strategy for Indian markets. Make it specific and actionable.`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    return this.executeAnalysis("strategy_generation", messages, { 
      cacheTTL: hasUserInput ? 1 : 300,
      maxTokens: 1500,
      skipCache: !hasUserInput
    });
  }

  async evaluateStrategy(
    strategyRules: unknown,
    backtestResults: unknown
  ): Promise<AIAnalysisResult> {
    return airaBrain.evaluateStrategy(strategyRules, backtestResults);
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
    return airaBrain.storeSignal(signal);
  }

  async getActiveSignals(instrumentToken?: number): Promise<unknown[]> {
    return airaBrain.getActiveSignals(instrumentToken);
  }

  async cleanupExpiredCache(): Promise<number> {
    return airaBrain.cleanupExpiredCache();
  }
}

export const aiSharedService = AISharedService.getInstance();
