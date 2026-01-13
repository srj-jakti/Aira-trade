import { airaBrain, AIAnalysisResult, AIConfig, MarketAnalysisInput } from "./aira-brain";
import { ZairothResult } from "@/lib/zairoth";

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
