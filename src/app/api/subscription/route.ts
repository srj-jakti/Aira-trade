import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SUBSCRIPTION_PLANS } from "@/lib/subscription/plans";
import { createOrder } from "@/lib/subscription/razorpay";

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

    if (planId === "admin") {
      return NextResponse.json({ error: "Invalid plan selection" }, { status: 400 });
    }

    const plan = SUBSCRIPTION_PLANS[planId as keyof typeof SUBSCRIPTION_PLANS];
    const amount = billingPeriod === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;

    const receipt = `sub_${user.id.slice(0, 8)}_${Date.now()}`;
    
    const order = await createOrder(amount, "INR", receipt, {
      user_id: user.id,
      plan_id: planId,
      billing_period: billingPeriod,
      user_email: user.email || "",
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      orderDetails: {
        planId,
        planName: plan.name,
        billingPeriod,
        amount,
        currency: "INR",
        disclaimer: "AiRA is a software platform providing analytical and automation tools only. It does not provide investment advice, trading recommendations, or financial services.",
      },
      prefill: {
        email: user.email,
        name: user.user_metadata?.full_name || "",
      },
    });
  } catch (error: any) {
    console.error("Subscription order creation error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
