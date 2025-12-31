import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  badRequestResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { encrypt, decrypt, maskCredential } from "@/lib/server/encryption";
import { credentialsSchema } from "@/lib/validations";
import { logAudit } from "@/lib/server/audit";

export async function GET() {
  const auth = await getAuthenticatedUser();
  if (!auth.authenticated) {
    return unauthorizedResponse();
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("user_config")
      .select("preferences")
      .eq("user_id", auth.userId)
      .single();

    if (error && error.code !== "PGRST116") {
      return serverErrorResponse();
    }

    if (!data?.preferences) {
      return successResponse({ credentials: {}, raw: {} });
    }

    const prefs = data.preferences as Record<string, string>;
    const masked: Record<string, string> = {};
    const raw: Record<string, string> = {};

    for (const [key, value] of Object.entries(prefs)) {
      if (value && typeof value === "string" && (key.includes("_key") || key.includes("_secret") || key.includes("_token"))) {
        try {
          const decrypted = decrypt(value);
          masked[key] = maskCredential(decrypted);
          raw[key] = decrypted;
        } catch {
          masked[key] = maskCredential(value);
          raw[key] = value;
        }
      }
    }

    return successResponse({ credentials: masked, raw });
  } catch {
    return serverErrorResponse();
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser();
  if (!auth.authenticated) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const validation = credentialsSchema.safeParse(body);

    if (!validation.success) {
      return badRequestResponse("Invalid credentials format", validation.error.flatten());
    }

    const encryptedPrefs: Record<string, string> = {};
    for (const [key, value] of Object.entries(validation.data)) {
      if (value && typeof value === "string" && value.trim()) {
        encryptedPrefs[key] = encrypt(value);
      }
    }

    const { data: existing } = await supabaseAdmin
      .from("user_config")
      .select("preferences")
      .eq("user_id", auth.userId)
      .single();

    const mergedPrefs = {
      ...(existing?.preferences || {}),
      ...encryptedPrefs,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabaseAdmin.from("user_config").upsert(
      {
        user_id: auth.userId,
        preferences: mergedPrefs,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id",
      }
    );

    if (error) {
      return serverErrorResponse();
    }

    await logAudit({
      user_id: auth.userId!,
      action: existing ? "credential_updated" : "credential_created",
      target_table: "user_config",
      metadata: { keys_updated: Object.keys(validation.data) },
    });

    return successResponse({ success: true });
  } catch {
    return serverErrorResponse();
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await getAuthenticatedUser();
  if (!auth.authenticated) {
    return unauthorizedResponse();
  }

  try {
    const { keys } = await request.json();

    if (!Array.isArray(keys) || keys.length === 0) {
      return badRequestResponse("Keys array required");
    }

    const { data: existing } = await supabaseAdmin
      .from("user_config")
      .select("preferences")
      .eq("user_id", auth.userId)
      .single();

    if (!existing?.preferences) {
      return successResponse({ success: true });
    }

    const updatedPrefs = { ...existing.preferences } as Record<string, unknown>;
    for (const key of keys) {
      delete updatedPrefs[key];
    }

    const { error } = await supabaseAdmin
      .from("user_config")
      .update({
        preferences: updatedPrefs,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", auth.userId);

    if (error) {
      return serverErrorResponse();
    }

    await logAudit({
      user_id: auth.userId!,
      action: "credential_deleted",
      target_table: "user_config",
      metadata: { keys_deleted: keys },
    });

    return successResponse({ success: true });
  } catch {
    return serverErrorResponse();
  }
}
