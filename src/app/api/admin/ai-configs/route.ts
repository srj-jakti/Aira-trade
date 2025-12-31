import { NextRequest } from "next/server";
import {
  getAdminUser,
  unauthorizedResponse,
  forbiddenResponse,
  badRequestResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { encrypt, decrypt, maskCredential } from "@/lib/server/encryption";
import { logAudit } from "@/lib/server/audit";

const AI_PROVIDERS = {
  openai: {
    name: "OpenAI",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
    testEndpoint: "https://api.openai.com/v1/models",
  },
  anthropic: {
    name: "Anthropic (Claude)",
    models: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"],
    testEndpoint: "https://api.anthropic.com/v1/messages",
  },
  google: {
    name: "Google (Gemini)",
    models: ["gemini-2.0-flash-exp", "gemini-1.5-pro", "gemini-1.5-flash"],
    testEndpoint: "https://generativelanguage.googleapis.com/v1beta/models",
  },
  groq: {
    name: "Groq",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
    testEndpoint: "https://api.groq.com/openai/v1/models",
  },
};

export async function GET() {
  const admin = await getAdminUser();
  if (!admin.authenticated) return unauthorizedResponse();
  if (!admin.isAdmin) return forbiddenResponse("Admin access required");

  try {
    const { data: configs, error } = await supabaseAdmin
      .from("admin_ai_configs")
      .select("*")
      .order("priority", { ascending: true });

    if (error) {
      console.error("Error fetching AI configs:", error);
      return serverErrorResponse();
    }

    const maskedConfigs = (configs || []).map((config) => ({
      ...config,
      api_key: maskCredential(decrypt(config.api_key)),
    }));

    return successResponse({ 
      configs: maskedConfigs,
      providers: AI_PROVIDERS,
    });
  } catch (error) {
    console.error("Error in AI configs GET:", error);
    return serverErrorResponse();
  }
}

export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin.authenticated) return unauthorizedResponse();
  if (!admin.isAdmin) return forbiddenResponse("Admin access required");

  try {
    const body = await request.json();
    const { provider, model, apiKey, isDefault, priority } = body;

    if (!provider || !model || !apiKey) {
      return badRequestResponse("Provider, model, and API key are required");
    }

    if (!AI_PROVIDERS[provider as keyof typeof AI_PROVIDERS]) {
      return badRequestResponse("Invalid provider");
    }

    if (isDefault) {
      await supabaseAdmin
        .from("admin_ai_configs")
        .update({ is_default: false })
        .eq("is_default", true);
    }

    const { data, error } = await supabaseAdmin
      .from("admin_ai_configs")
      .insert({
        provider,
        model,
        api_key: encrypt(apiKey),
        is_default: isDefault || false,
        priority: priority || 1,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating AI config:", error);
      return serverErrorResponse();
    }

    await logAudit({
      user_id: admin.userId!,
      action: "ai_config_created",
      target_table: "admin_ai_configs",
      target_id: data.id,
      metadata: { provider, model },
    });

    return successResponse({ 
      config: {
        ...data,
        api_key: maskCredential(apiKey),
      }
    });
  } catch (error) {
    console.error("Error in AI configs POST:", error);
    return serverErrorResponse();
  }
}
