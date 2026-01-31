import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  badRequestResponse,
  successResponse,
  serverErrorResponse,
} from "@/lib/server/auth";
import { quoteCache } from "@/lib/server/quote-cache";
import { apiKeyPoolManager } from "@/lib/server/api-key-pool-manager";

export const dynamic = "force-dynamic";

let configsInitialized = false;

async function ensureConfigs() {
  if (configsInitialized) return;

  try {
    const analysisKeys = await apiKeyPoolManager.getAnalysisKeys();
    const scannerKey = await apiKeyPoolManager.getScannerKey();

    // Decrypt if necessary (ApiKeyPoolManager returns decrypted via getDecryptedCredentials usually, 
    // but here we are using the raw pool configs which might be encrypted)
    const decryptedAnalysis = await Promise.all(analysisKeys.map(async (k) => {
      return await apiKeyPoolManager.getDecryptedCredentials(k.id);
    }));

    const decryptedScanner = scannerKey ? await apiKeyPoolManager.getDecryptedCredentials(scannerKey.id) : null;

    quoteCache.setConfigs(
      decryptedScanner ? { apiKey: decryptedScanner.apiKey, accessToken: decryptedScanner.accessToken || '' } : null,
      decryptedAnalysis.filter((d): d is NonNullable<typeof d> => d !== null).map(d => ({
        apiKey: d.apiKey,
        accessToken: d.accessToken || ''
      }))
    );
    
    configsInitialized = true;
    
    // Auto-refresh every 5 minutes
    setTimeout(() => {
      configsInitialized = false;
    }, 5 * 60 * 1000);
  } catch (error) {
    console.error("[OnDemand] Failed to initialize configs:", error);
  }
}

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated) return unauthorizedResponse();

  const searchParams = request.nextUrl.searchParams;
  const instrumentsParam = searchParams.get("instruments");
  const useScanner = searchParams.get("scanner") === "true";

  if (!instrumentsParam) {
    return badRequestResponse("instruments parameter required (comma-separated tokens)");
  }

  const tokens = instrumentsParam
    .split(",")
    .map((t) => parseInt(t.trim()))
    .filter((t) => !isNaN(t) && t > 0);

  if (tokens.length === 0) {
    return badRequestResponse("At least one valid instrument token required");
  }

  // Bundle limit increased to support "combining all users access"
  if (tokens.length > 2000) {
    return badRequestResponse("Maximum 2000 instruments per request");
  }

  try {
    await ensureConfigs();

    // Verify if we have valid configs to proceed
    const stats = quoteCache.getStats();
    if (stats.analysisKeys === 0 && !useScanner) {
      console.warn("[OnDemand] No analysis keys available");
      // Attempt one more forced refresh if missing
      configsInitialized = false;
      await ensureConfigs();
      if (quoteCache.getStats().analysisKeys === 0) {
        return serverErrorResponse("Service configuration unavailable");
      }
    }

    const quotesMap = await quoteCache.getQuotes(tokens, useScanner);

    const quotes: Record<string, any> = {};

    for (const [token, data] of quotesMap) {
      quotes[String(token)] = data;
    }

    return successResponse({
      success: true,
      quotes,
      count: Object.keys(quotes).length,
      timestamp: new Date().toISOString(),
      cacheStats: quoteCache.getStats(),
    });
  } catch (error) {
    console.error("[OnDemand] Error:", error);
    return serverErrorResponse();
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
