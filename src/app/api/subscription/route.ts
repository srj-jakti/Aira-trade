import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const SUBSCRIPTION_PLANS = {
  basic: {
    id: "basic",
    name: "BASIC",
    subtitle: "Platform Access",
    monthlyPrice: 999,
    yearlyPrice: 9990,
    features: {
      strategyCreation: true,
      strategyLibrary: true,
      aiAnalysis: true,
      marketScanner: true,
      automatedExecution: false,
      brokerConnection: false,
      inviteOnlyStrategies: false,
      backgroundAutomation: false,
      autoBrokerLogin: false,
      adminPanel: false,
    },
    sebiLabel: "For research, analysis, and strategy development only.",
  },
  pro: {
    id: "pro",
    name: "PRO",
    subtitle: "User-Controlled Automation",
    monthlyPrice: 1499,
    yearlyPrice: 14990,
    features: {
      strategyCreation: true,
      strategyLibrary: true,
      aiAnalysis: true,
      marketScanner: true,
      automatedExecution: true,
      brokerConnection: true,
      inviteOnlyStrategies: false,
      backgroundAutomation: false,
      autoBrokerLogin: false,
      adminPanel: false,
    },
    sebiLabel: "Execution automation based on user-defined logic. No advisory or discretionary actions.",
  },
  elite: {
    id: "elite",
    name: "ELITE",
    subtitle: "Advanced Automation & Strategy Sharing",
    monthlyPrice: 2499,
    yearlyPrice: 24990,
    features: {
      strategyCreation: true,
      strategyLibrary: true,
      aiAnalysis: true,
      marketScanner: true,
      automatedExecution: true,
      brokerConnection: true,
      inviteOnlyStrategies: true,
      backgroundAutomation: true,
      autoBrokerLogin: true,
      adminPanel: false,
    },
    sebiLabel: "Advanced execution automation and private strategy distribution tools. User retains full control.",
  },
  admin: {
    id: "admin",
    name: "ADMIN",
    subtitle: "Full Access",
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: {
      strategyCreation: true,
      strategyLibrary: true,
      aiAnalysis: true,
      marketScanner: true,
      automatedExecution: true,
      brokerConnection: true,
      inviteOnlyStrategies: true,
      backgroundAutomation: true,
      autoBrokerLogin: true,
      adminPanel: true,
    },
    sebiLabel: "Admin access with all features enabled.",
  },
};

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: subscription, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    return NextResponse.json({
      success: true,
      subscription: subscription || null,
      plans: SUBSCRIPTION_PLANS,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { planId, billingPeriod = "monthly" } = body;

    if (!planId || !SUBSCRIPTION_PLANS[planId as keyof typeof SUBSCRIPTION_PLANS]) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const plan = SUBSCRIPTION_PLANS[planId as keyof typeof SUBSCRIPTION_PLANS];
    const amount = billingPeriod === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;

    return NextResponse.json({
      success: true,
      message: "Payment gateway integration pending",
      orderDetails: {
        planId,
        planName: plan.name,
        billingPeriod,
        amount,
        currency: "INR",
        disclaimer: "AiRA is a software platform providing analytical and automation tools only. It does not provide investment advice, trading recommendations, or financial services.",
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
