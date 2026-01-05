import { processZairoth, processZairothSafe, ZairothResult, CanonicalIntent, ZairothError } from "@/lib/zairoth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export interface GatewayRequest {
  input: string;
  source: "strategy" | "scanner" | "backtest" | "analysis" | "execution";
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface GatewayResponse {
  success: boolean;
  canonical?: CanonicalIntent[];
  zairothResult?: ZairothResult;
  error?: string;
  gatewayId: string;
  timestamp: Date;
}

export class IntentGateway {
  private static instance: IntentGateway;

  private constructor() {}

  static getInstance(): IntentGateway {
    if (!IntentGateway.instance) {
      IntentGateway.instance = new IntentGateway();
    }
    return IntentGateway.instance;
  }

  async process(request: GatewayRequest): Promise<GatewayResponse> {
    const gatewayId = `gw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = new Date();

    try {
      const result = processZairoth(request.input);

      await this.logGatewayRequest({
        gatewayId,
        source: request.source,
        userId: request.userId,
        input: request.input,
        success: true,
        zairothRaw: result.raw,
        canonical: result.canonical,
        validation: result.validation,
        metadata: request.metadata,
        timestamp,
      });

      return {
        success: true,
        canonical: result.canonical,
        zairothResult: result,
        gatewayId,
        timestamp,
      };
    } catch (error) {
      const errorMessage = error instanceof ZairothError 
        ? error.message 
        : (error instanceof Error ? error.message : "Unknown error");

      await this.logGatewayRequest({
        gatewayId,
        source: request.source,
        userId: request.userId,
        input: request.input,
        success: false,
        error: errorMessage,
        metadata: request.metadata,
        timestamp,
      });

      return {
        success: false,
        error: errorMessage,
        gatewayId,
        timestamp,
      };
    }
  }

  async processSafe(request: GatewayRequest): Promise<GatewayResponse> {
    const gatewayId = `gw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = new Date();

    const result = processZairothSafe(request.input);

    if (result.success) {
      await this.logGatewayRequest({
        gatewayId,
        source: request.source,
        userId: request.userId,
        input: request.input,
        success: true,
        zairothRaw: result.result.raw,
        canonical: result.result.canonical,
        validation: result.result.validation,
        metadata: request.metadata,
        timestamp,
      });

      return {
        success: true,
        canonical: result.result.canonical,
        zairothResult: result.result,
        gatewayId,
        timestamp,
      };
    } else {
      await this.logGatewayRequest({
        gatewayId,
        source: request.source,
        userId: request.userId,
        input: request.input,
        success: false,
        error: result.error,
        validation: result.validation,
        metadata: request.metadata,
        timestamp,
      });

      return {
        success: false,
        error: result.error,
        gatewayId,
        timestamp,
      };
    }
  }

  async validateOnly(input: string): Promise<{ valid: boolean; errors: string[] }> {
    const result = processZairothSafe(input);
    
    if (result.success) {
      return { valid: true, errors: [] };
    }

    return {
      valid: false,
      errors: result.validation?.errors.map(e => e.message) || [result.error],
    };
  }

  private async logGatewayRequest(log: {
    gatewayId: string;
    source: string;
    userId?: string;
    input: string;
    success: boolean;
    zairothRaw?: string;
    canonical?: CanonicalIntent[];
    validation?: unknown;
    error?: string;
    metadata?: Record<string, unknown>;
    timestamp: Date;
  }): Promise<void> {
    try {
      await supabaseAdmin.from("intent_gateway_logs").insert({
        gateway_id: log.gatewayId,
        source: log.source,
        user_id: log.userId,
        input_text: log.input,
        success: log.success,
        zairoth_raw: log.zairothRaw,
        canonical_json: log.canonical,
        validation_result: log.validation,
        error_message: log.error,
        metadata: log.metadata,
        created_at: log.timestamp.toISOString(),
      });
    } catch (error) {
      console.error("[IntentGateway] Failed to log request:", error);
    }
  }

  async rejectBypass(rawAiOutput: unknown, source: string): Promise<never> {
    await supabaseAdmin.from("intent_gateway_violations").insert({
      source,
      attempted_bypass: JSON.stringify(rawAiOutput).slice(0, 1000),
      created_at: new Date().toISOString(),
    });

    throw new Error(`[GATEWAY VIOLATION] Raw AI output attempted to bypass ZAIROTH validation from source: ${source}`);
  }
}

export const intentGateway = IntentGateway.getInstance();
