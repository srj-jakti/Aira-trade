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
import { decrypt } from "@/lib/server/encryption";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ configId: string }> }
) {
  const admin = await getAdminUser();
  if (!admin.authenticated) return unauthorizedResponse();
  if (!admin.isAdmin) return forbiddenResponse("Admin access required");

  const { configId } = await params;

  try {
    const { data: config, error } = await supabaseAdmin
      .from("admin_ai_configs")
      .select("*")
      .eq("id", configId)
      .single();

    if (error || !config) {
      return badRequestResponse("Configuration not found");
    }

    const apiKey = decrypt(config.api_key);
    let testResult: { success: boolean; error?: string } = {
      success: false,
      error: "Unknown provider",
    };

    switch (config.provider) {
      case "openai":
        testResult = await testOpenAI(apiKey);
        break;
      case "anthropic":
        testResult = await testAnthropic(apiKey);
        break;
      case "google":
        testResult = await testGoogle(apiKey);
        break;
      case "groq":
        testResult = await testGroq(apiKey);
        break;
    }

    await supabaseAdmin
      .from("admin_ai_configs")
      .update({
        last_request_at: new Date().toISOString(),
        last_error: testResult.success ? null : testResult.error,
        updated_at: new Date().toISOString(),
      })
      .eq("id", configId);

    return successResponse(testResult);
  } catch (error) {
    console.error("Error testing AI config:", error);
    return serverErrorResponse();
  }
}

async function testOpenAI(apiKey: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (response.ok) {
      return { success: true };
    }
    const data = await response.json();
    return { success: false, error: data.error?.message || "API request failed" };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Connection failed" };
  }
}

async function testAnthropic(apiKey: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 10,
        messages: [{ role: "user", content: "Hi" }],
      }),
    });
    if (response.ok) {
      return { success: true };
    }
    const data = await response.json();
    return { success: false, error: data.error?.message || "API request failed" };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Connection failed" };
  }
}

async function testGoogle(apiKey: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    if (response.ok) {
      return { success: true };
    }
    const data = await response.json();
    return { success: false, error: data.error?.message || "API request failed" };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Connection failed" };
  }
}

async function testGroq(apiKey: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (response.ok) {
      return { success: true };
    }
    const data = await response.json();
    return { success: false, error: data.error?.message || "API request failed" };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Connection failed" };
  }
}
