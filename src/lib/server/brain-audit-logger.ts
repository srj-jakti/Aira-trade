import { supabaseAdmin } from "@/lib/supabase/admin";

export type AuditType = 
  | "ZAIROTH_GENERATION"
  | "ZAIROTH_VALIDATION"
  | "INTENT_GATEWAY_PROCESS"
  | "STRATEGY_CREATE"
  | "STRATEGY_UPDATE"
  | "BACKTEST_RUN"
  | "SIGNAL_GENERATE"
  | "EXECUTION_REQUEST"
  | "SAFETY_CHECK";

export interface AuditLogEntry {
  auditType: AuditType;
  userId?: string;
  englishInput?: string;
  zairothIntent?: string;
  validationResult?: unknown;
  compiledJson?: unknown;
  downstreamUsage?: string;
  sourceModule: string;
  requestId?: string;
}

class BrainAuditLogger {
  private static instance: BrainAuditLogger;

  private constructor() {}

  static getInstance(): BrainAuditLogger {
    if (!BrainAuditLogger.instance) {
      BrainAuditLogger.instance = new BrainAuditLogger();
    }
    return BrainAuditLogger.instance;
  }

  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await supabaseAdmin.from("brain_audit_logs").insert({
        audit_type: entry.auditType,
        user_id: entry.userId,
        english_input: entry.englishInput,
        zairoth_intent: entry.zairothIntent,
        validation_result: entry.validationResult,
        compiled_json: entry.compiledJson,
        downstream_usage: entry.downstreamUsage,
        source_module: entry.sourceModule,
        request_id: entry.requestId,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[BrainAuditLogger] Failed to log audit entry:", error);
    }
  }

  async logZairothGeneration(params: {
    userId?: string;
    englishInput: string;
    zairothOutput: string;
    validationResult: unknown;
    compiledJson: unknown;
    success: boolean;
    sourceModule: string;
  }): Promise<void> {
    await this.log({
      auditType: "ZAIROTH_GENERATION",
      userId: params.userId,
      englishInput: params.englishInput,
      zairothIntent: params.zairothOutput,
      validationResult: params.validationResult,
      compiledJson: params.compiledJson,
      downstreamUsage: params.success ? "compiled" : "rejected",
      sourceModule: params.sourceModule,
    });
  }

  async logIntentGateway(params: {
    userId?: string;
    input: string;
    gatewayId: string;
    success: boolean;
    canonical?: unknown;
    error?: string;
    sourceModule: string;
  }): Promise<void> {
    await this.log({
      auditType: "INTENT_GATEWAY_PROCESS",
      userId: params.userId,
      englishInput: params.input,
      compiledJson: params.canonical,
      validationResult: params.success ? { status: "passed" } : { status: "failed", error: params.error },
      downstreamUsage: params.success ? "forwarded" : "blocked",
      sourceModule: params.sourceModule,
      requestId: params.gatewayId,
    });
  }

  async logSafetyCheck(params: {
    userId?: string;
    zairothIntent: string;
    context: unknown;
    result: { stop: boolean; reason?: string };
    sourceModule: string;
  }): Promise<void> {
    await this.log({
      auditType: "SAFETY_CHECK",
      userId: params.userId,
      zairothIntent: params.zairothIntent,
      validationResult: { context: params.context, result: params.result },
      downstreamUsage: params.result.stop ? "BLOCKED" : "ALLOWED",
      sourceModule: params.sourceModule,
    });
  }

  async getRecentLogs(options: {
    userId?: string;
    auditType?: AuditType;
    limit?: number;
    offset?: number;
  }): Promise<unknown[]> {
    let query = supabaseAdmin
      .from("brain_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(options.limit || 100);

    if (options.userId) {
      query = query.eq("user_id", options.userId);
    }

    if (options.auditType) {
      query = query.eq("audit_type", options.auditType);
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 100) - 1);
    }

    const { data } = await query;
    return data || [];
  }

  async getAuditStats(): Promise<{
    totalLogs: number;
    byType: Record<string, number>;
    successRate: number;
  }> {
    const { data: logs } = await supabaseAdmin
      .from("brain_audit_logs")
      .select("audit_type, downstream_usage")
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (!logs) return { totalLogs: 0, byType: {}, successRate: 0 };

    const byType: Record<string, number> = {};
    let successCount = 0;

    logs.forEach((log) => {
      byType[log.audit_type] = (byType[log.audit_type] || 0) + 1;
      if (log.downstream_usage !== "rejected" && log.downstream_usage !== "blocked") {
        successCount++;
      }
    });

    return {
      totalLogs: logs.length,
      byType,
      successRate: logs.length > 0 ? (successCount / logs.length) * 100 : 0,
    };
  }
}

export const brainAuditLogger = BrainAuditLogger.getInstance();
