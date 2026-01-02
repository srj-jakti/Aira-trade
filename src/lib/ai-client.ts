import { supabaseAdmin } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/server/encryption";

interface AIClient {
  provider: string;
  model: string;
  chat: {
    completions: {
      create: (params: {
        model: string;
        messages: Array<{ role: string; content: string }>;
        max_tokens?: number;
        temperature?: number;
      }) => Promise<{
        choices: Array<{
          message: {
            content: string;
          };
        }>;
      }>;
    };
  };
}

export async function getAIClient(): Promise<AIClient | null> {
  const { data: config } = await supabaseAdmin
    .from("admin_ai_configs")
    .select("*")
    .eq("is_active", true)
    .eq("is_default", true)
    .single();

  if (!config) {
    const { data: anyConfig } = await supabaseAdmin
      .from("admin_ai_configs")
      .select("*")
      .eq("is_active", true)
      .order("priority", { ascending: true })
      .limit(1)
      .single();

    if (!anyConfig) return null;
    return createClient(anyConfig);
  }

  return createClient(config);
}

function createClient(config: {
  provider: string;
  model: string;
  api_key: string;
}): AIClient {
  const apiKey = decrypt(config.api_key);

  return {
    provider: config.provider,
    model: config.model,
    chat: {
      completions: {
        create: async (params) => {
          switch (config.provider) {
            case "openai":
              return callOpenAI(apiKey, params);
            case "anthropic":
              return callAnthropic(apiKey, params);
            case "groq":
              return callGroq(apiKey, params);
            case "google":
              return callGoogle(apiKey, params);
            default:
              throw new Error(`Unsupported provider: ${config.provider}`);
          }
        },
      },
    },
  };
}

async function callOpenAI(
  apiKey: string,
  params: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    max_tokens?: number;
    temperature?: number;
  }
) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      messages: params.messages,
      max_tokens: params.max_tokens || 1500,
      temperature: params.temperature || 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "OpenAI API request failed");
  }

  return response.json();
}

async function callAnthropic(
  apiKey: string,
  params: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    max_tokens?: number;
    temperature?: number;
  }
) {
  const systemMessage = params.messages.find((m) => m.role === "system");
  const userMessages = params.messages.filter((m) => m.role !== "system");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model.includes("claude") ? params.model : "claude-3-5-sonnet-20241022",
      max_tokens: params.max_tokens || 1500,
      system: systemMessage?.content || "",
      messages: userMessages.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Anthropic API request failed");
  }

  const data = await response.json();
  return {
    choices: [
      {
        message: {
          content: data.content?.[0]?.text || "",
        },
      },
    ],
  };
}

async function callGroq(
  apiKey: string,
  params: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    max_tokens?: number;
    temperature?: number;
  }
) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      messages: params.messages,
      max_tokens: params.max_tokens || 1500,
      temperature: params.temperature || 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Groq API request failed");
  }

  return response.json();
}

async function callGoogle(
  apiKey: string,
  params: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    max_tokens?: number;
    temperature?: number;
  }
) {
  const model = params.model || "gemini-1.5-flash";
  const contents = params.messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents,
        generationConfig: {
          maxOutputTokens: params.max_tokens || 1500,
          temperature: params.temperature || 0.7,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Google AI API request failed");
  }

  const data = await response.json();
  return {
    choices: [
      {
        message: {
          content: data.candidates?.[0]?.content?.parts?.[0]?.text || "",
        },
      },
    ],
  };
}
