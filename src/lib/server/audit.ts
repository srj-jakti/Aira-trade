import { supabaseAdmin } from "@/lib/supabase/admin";

export type AuditAction =
  | "credential_created"
  | "credential_updated"
  | "credential_deleted"
  | "trading_enabled"
  | "trading_disabled"
  | "risk_settings_updated"
  | "admin_user_approved"
  | "admin_user_rejected"
  | "admin_user_deleted"
  | "admin_config_updated"
  | "profile_updated";

interface AuditLogEntry {
  user_id: string;
  action: AuditAction;
  target_table?: string;
  target_id?: string;
  metadata?: Record<string, unknown>;
  ip_address?: string;
}

export async function logAudit(entry: AuditLogEntry): Promise<void> {
  try {
    await supabaseAdmin.from("audit_logs").insert({
      ...entry,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Audit log failed:", error);
  }
}
