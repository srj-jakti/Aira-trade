import { NextRequest } from "next/server";
import {
  getAdminUser,
  unauthorizedResponse,
  successResponse,
  serverErrorResponse,
} from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAIClient } from "@/lib/ai-client";

interface ScalingRecommendation {
  category: "api_keys" | "vercel" | "supabase" | "railway";
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  action: string;
  threshold?: string;
  current?: string;
}

interface SystemHealthAnalysis {
  overall: "healthy" | "warning" | "critical";
  score: number;
  recommendations: ScalingRecommendation[];
  metrics: {
    apiKeys: {
      configured: number;
      active: number;
      needed: number;
      tiers: { CORE: boolean; POPULAR: boolean; TEMP: boolean };
    };
    subscriptions: {
      total: number;
      byTier: { CORE: number; POPULAR: number; TEMP: number };
      capacity: number;
      utilizationPercent: number;
    };
    websockets: {
      total: number;
      connected: number;
      fallbackActive: number;
    };
    performance: {
      ticksPerSecond: number;
      avgQueryTime: number;
      errorRate: number;
    };
    users: {
      total: number;
      activeToday: number;
      tradingEnabled: number;
    };
    database: {
      ticksCount: number;
      candlesCount: number;
      signalsCount: number;
    };
  };
}

export async function GET(request: NextRequest) {
  const adminResult = await getAdminUser();
  if (!adminResult.authenticated || !adminResult.isAdmin) {
    return unauthorizedResponse();
  }

  try {
    const analysis = await analyzeSystemHealth();
    return successResponse(analysis);
  } catch (error) {
    console.error("Error analyzing system health:", error);
    return serverErrorResponse();
  }
}

export async function POST(request: NextRequest) {
  const adminResult = await getAdminUser();
  if (!adminResult.authenticated || !adminResult.isAdmin) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const { health, analysis, requestAiAnalysis } = body;

    if (!requestAiAnalysis) {
      return successResponse({ aiAnalysis: null });
    }

    const aiClient = await getAIClient();
    if (!aiClient) {
      return successResponse({ 
        aiAnalysis: "AI analysis is unavailable. Please configure an AI provider in Admin > AI Config." 
      });
    }

    const systemContext = `
SYSTEM HEALTH DATA:
- Zerodha APIs: ${health?.zerodha?.connected || 0}/${health?.zerodha?.total || 0} connected
- AI Providers: ${health?.ai?.active || 0}/${health?.ai?.total || 0} active
- Database Status: ${health?.database?.status || "unknown"}
- Total Users: ${health?.database?.totalUsers || 0}
- Active Users (24h): ${health?.database?.activeUsers24h || 0}
- Total Trades: ${health?.database?.totalTrades || 0}
- Errors (24h): Zerodha=${health?.errors?.zerodhaErrors24h || 0}, AI=${health?.errors?.aiErrors24h || 0}, Auth=${health?.errors?.authErrors24h || 0}

SCALING METRICS:
- Health Score: ${analysis?.score || 0}/100
- Overall Status: ${analysis?.overall || "unknown"}
- API Keys: ${analysis?.metrics?.apiKeys?.active || 0}/${analysis?.metrics?.apiKeys?.needed || 3} active
- Tiers Configured: CORE=${analysis?.metrics?.apiKeys?.tiers?.CORE}, POPULAR=${analysis?.metrics?.apiKeys?.tiers?.POPULAR}, TEMP=${analysis?.metrics?.apiKeys?.tiers?.TEMP}
- Subscriptions: ${analysis?.metrics?.subscriptions?.total || 0} total (${analysis?.metrics?.subscriptions?.utilizationPercent || 0}% capacity)
- By Tier: CORE=${analysis?.metrics?.subscriptions?.byTier?.CORE || 0}, POPULAR=${analysis?.metrics?.subscriptions?.byTier?.POPULAR || 0}, TEMP=${analysis?.metrics?.subscriptions?.byTier?.TEMP || 0}
- Trading Users: ${analysis?.metrics?.users?.tradingEnabled || 0}
- Ticks/Second: ${analysis?.metrics?.performance?.ticksPerSecond || 0}
- Database: ${((analysis?.metrics?.database?.ticksCount || 0) / 1000000).toFixed(1)}M ticks, ${((analysis?.metrics?.database?.candlesCount || 0) / 1000).toFixed(0)}K candles

CURRENT RECOMMENDATIONS:
${analysis?.recommendations?.map((r: { severity: string; title: string; description: string }) => `- [${r.severity.toUpperCase()}] ${r.title}: ${r.description}`).join('\n') || 'None'}
`;

    const prompt = `You are a DevOps and system architecture expert analyzing an algorithmic trading platform. Based on the system health data below, provide a comprehensive analysis report.

${systemContext}

Provide a detailed analysis covering:
1. **Overall System Health** - Brief assessment of the current state
2. **Critical Issues** - Any immediate problems that need attention
3. **Performance Analysis** - How the system is performing under current load
4. **Scaling Recommendations** - When to upgrade Vercel (Pro/Enterprise), Supabase (Pro/Team), Railway (Pro), or add more API keys
5. **Cost Optimization** - Ways to reduce costs without impacting performance
6. **Security Concerns** - API key rotation, token expiry, authentication issues
7. **Growth Projections** - Based on current user growth, when will infrastructure need scaling

Keep the analysis concise but actionable. Focus on practical recommendations with specific thresholds.`;

    const response = await aiClient.chat.completions.create({
      model: aiClient.model || "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are an expert DevOps engineer specializing in algorithmic trading platforms. Provide concise, actionable analysis." },
        { role: "user", content: prompt }
      ],
      max_tokens: 1500,
      temperature: 0.7,
    });

    const aiAnalysis = response.choices[0]?.message?.content || "Unable to generate analysis.";

    return successResponse({ aiAnalysis });
  } catch (error) {
    console.error("Error running AI analysis:", error);
    return successResponse({ 
      aiAnalysis: "Failed to generate AI analysis. Please check that your AI provider is configured correctly." 
    });
  }
}

async function analyzeSystemHealth(): Promise<SystemHealthAnalysis> {
  const recommendations: ScalingRecommendation[] = [];

  const { data: zerodhaConfigs } = await supabaseAdmin
    .from("admin_zerodha_configs")
    .select("id, name, connection_status, is_active, is_authorized, priority")
    .eq("is_active", true)
    .order("priority");

  const { data: aiConfigs } = await supabaseAdmin
    .from("admin_ai_configs")
    .select("id, is_active")
    .eq("is_active", true);

  const configuredKeys = zerodhaConfigs?.length || 0;
  const connectedKeys = zerodhaConfigs?.filter(c => c.connection_status === "connected" && c.is_authorized).length || 0;
  const activeKeys = connectedKeys;
  
  const tiers = {
    CORE: connectedKeys >= 1,
    POPULAR: connectedKeys >= 2,
    TEMP: connectedKeys >= 3,
  };

  const { data: subscriptions } = await supabaseAdmin
    .from("instrument_subscriptions")
    .select("priority");

  const subscriptionStats = {
    total: subscriptions?.length || 0,
    byTier: {
      CORE: subscriptions?.filter(s => s.priority === "CORE").length || 0,
      POPULAR: subscriptions?.filter(s => s.priority === "POPULAR").length || 0,
      TEMP: subscriptions?.filter(s => s.priority === "TEMP").length || 0,
    },
    capacity: activeKeys * 3000,
    utilizationPercent: 0,
  };
  subscriptionStats.utilizationPercent = subscriptionStats.capacity > 0
    ? Math.round((subscriptionStats.total / subscriptionStats.capacity) * 100)
    : 0;

  const { data: engineStatus } = await supabaseAdmin
    .from("data_engine_status")
    .select("*")
    .eq("engine_type", "market_data")
    .single();

  const { count: totalUsers } = await supabaseAdmin
    .from("profiles")
    .select("*", { count: "exact", head: true });

  const { count: activeUsers } = await supabaseAdmin
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .gte("updated_at", new Date(Date.now() - 86400000).toISOString());

  const { count: tradingUsers } = await supabaseAdmin
    .from("user_trading_settings")
    .select("*", { count: "exact", head: true })
    .eq("trading_enabled", true);

  const { count: ticksCount } = await supabaseAdmin
    .from("realtime_ticks")
    .select("*", { count: "exact", head: true });

  const { count: candlesCount } = await supabaseAdmin
    .from("live_candles")
    .select("*", { count: "exact", head: true });

  const { count: signalsCount } = await supabaseAdmin
    .from("ai_signals")
    .select("*", { count: "exact", head: true });

  const disconnectedKeys = zerodhaConfigs?.filter(c => c.connection_status !== "connected" || !c.is_authorized) || [];
  
  if (disconnectedKeys.length > 0) {
    recommendations.push({
      category: "api_keys",
      severity: "warning",
      title: `${disconnectedKeys.length} API Key(s) Not Connected`,
      description: `Keys not connected: ${disconnectedKeys.map(k => k.name).join(", ")}. These need to be logged in.`,
      action: "Go to Admin > APIs and click Login on disconnected keys.",
      threshold: "0 disconnected",
      current: `${disconnectedKeys.length} disconnected`,
    });
  }

  if (connectedKeys === 0) {
    recommendations.push({
      category: "api_keys",
      severity: "critical",
      title: "No Zerodha API Keys Connected",
      description: "No API keys are currently connected. Market data and trading features will not work.",
      action: "Go to Admin > APIs and login to at least one Zerodha configuration.",
    });
  }

  if (configuredKeys === 0) {
    recommendations.push({
      category: "api_keys",
      severity: "critical",
      title: "No Zerodha API Keys Configured",
      description: "Add at least one Zerodha API configuration to enable market data features.",
      action: "Go to Admin > APIs and add a new Zerodha configuration.",
    });
  }

  if ((aiConfigs?.length || 0) === 0) {
    recommendations.push({
      category: "api_keys",
      severity: "warning",
      title: "No AI Provider Configured",
      description: "AI analysis and strategy recommendations require an AI provider.",
      action: "Go to Admin > AI and add an AI provider (OpenAI, Anthropic, etc.).",
    });
  }

  if (subscriptionStats.utilizationPercent > 80) {
    recommendations.push({
      category: "api_keys",
      severity: "critical",
      title: "WebSocket Capacity Critical",
      description: `${subscriptionStats.utilizationPercent}% of subscription capacity used. System may reject new subscriptions.`,
      action: "Add another Zerodha API key immediately or reduce POPULAR/TEMP subscriptions.",
      threshold: "80%",
      current: `${subscriptionStats.utilizationPercent}%`,
    });
  } else if (subscriptionStats.utilizationPercent > 60) {
    recommendations.push({
      category: "api_keys",
      severity: "warning",
      title: "WebSocket Capacity High",
      description: `${subscriptionStats.utilizationPercent}% of subscription capacity used. Plan for additional API key.`,
      action: "Consider adding another Zerodha API key before reaching 80% capacity.",
      threshold: "60%",
      current: `${subscriptionStats.utilizationPercent}%`,
    });
  }

  const usersPerKey = (totalUsers || 0) / Math.max(activeKeys, 1);
  if (usersPerKey > 100) {
    recommendations.push({
      category: "api_keys",
      severity: "warning",
      title: "High Users per API Key Ratio",
      description: `${Math.round(usersPerKey)} users per API key. Recommended: <100 users per key for optimal performance.`,
      action: "Add more Zerodha API keys as user base grows.",
      threshold: "100 users/key",
      current: `${Math.round(usersPerKey)} users/key`,
    });
  }

  if ((totalUsers || 0) > 50) {
    recommendations.push({
      category: "vercel",
      severity: "info",
      title: "Consider Vercel Pro Plan",
      description: "With 50+ users, you may benefit from Vercel Pro for better performance and higher limits.",
      action: "Upgrade to Vercel Pro for faster builds, more serverless function execution time, and priority support.",
      threshold: "50 users",
      current: `${totalUsers} users`,
    });
  }

  if ((ticksCount || 0) > 1000000) {
    recommendations.push({
      category: "supabase",
      severity: "warning",
      title: "High Tick Data Volume",
      description: `${((ticksCount || 0) / 1000000).toFixed(1)}M ticks stored. Consider data retention policy or Supabase Pro.`,
      action: "Implement tick data cleanup (older than 7 days) or upgrade Supabase plan for more storage.",
      threshold: "1M ticks",
      current: `${((ticksCount || 0) / 1000000).toFixed(1)}M ticks`,
    });
  }

  if ((tradingUsers || 0) > 10) {
    recommendations.push({
      category: "railway",
      severity: "info",
      title: "Scale Trading Engine",
      description: `${tradingUsers} users with trading enabled. Consider Railway Pro for higher reliability.`,
      action: "Upgrade Railway plan for better uptime guarantees and more compute resources.",
      threshold: "10 trading users",
      current: `${tradingUsers} trading users`,
    });
  }

  if (engineStatus?.websocket_status !== "connected") {
    recommendations.push({
      category: "railway",
      severity: "critical",
      title: "Market Data Worker Disconnected",
      description: "The Railway market data worker is not connected. Real-time data is unavailable.",
      action: "Check Railway logs, verify Zerodha credentials, and redeploy if needed.",
    });
  }

  let score = 100;
  let criticalCount = 0;
  let warningCount = 0;

  for (const rec of recommendations) {
    if (rec.severity === "critical") {
      score -= 25;
      criticalCount++;
    } else if (rec.severity === "warning") {
      score -= 10;
      warningCount++;
    } else {
      score -= 2;
    }
  }

  score = Math.max(0, score);

  let overall: "healthy" | "warning" | "critical" = "healthy";
  if (criticalCount > 0 || score < 50) {
    overall = "critical";
  } else if (warningCount > 0 || score < 75) {
    overall = "warning";
  }

  return {
    overall,
    score,
    recommendations: recommendations.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    }),
    metrics: {
      apiKeys: {
        configured: configuredKeys,
        active: connectedKeys,
        needed: Math.max(1, configuredKeys),
        tiers,
      },
      subscriptions: subscriptionStats,
      websockets: {
        total: configuredKeys,
        connected: connectedKeys,
        fallbackActive: 0,
      },
      performance: {
        ticksPerSecond: engineStatus?.ticks_per_second || 0,
        avgQueryTime: 0,
        errorRate: 0,
      },
      users: {
        total: totalUsers || 0,
        activeToday: activeUsers || 0,
        tradingEnabled: tradingUsers || 0,
      },
      database: {
        ticksCount: ticksCount || 0,
        candlesCount: candlesCount || 0,
        signalsCount: signalsCount || 0,
      },
    },
  };
}
