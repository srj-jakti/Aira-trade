import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyPaymentSignature, razorpay } from "@/lib/subscription/razorpay";
import { SUBSCRIPTION_PLANS } from "@/lib/subscription/plans";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId, billingPeriod } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: "Missing payment details" }, { status: 400 });
    }

    const isValid = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    
    if (!isValid) {
      return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
    }

    const payment = await razorpay.payments.fetch(razorpay_payment_id);
    
    if (payment.status !== "captured") {
      return NextResponse.json({ error: "Payment not captured" }, { status: 400 });
    }

    const plan = SUBSCRIPTION_PLANS[planId as keyof typeof SUBSCRIPTION_PLANS];
    if (!plan) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const periodMonths = billingPeriod === "yearly" ? 12 : 1;
    const currentPeriodStart = new Date();
    const currentPeriodEnd = new Date();
    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + periodMonths);

    const subscriptionData = {
      user_id: user.id,
      plan_id: planId,
      plan_name: plan.name.toLowerCase(),
      status: "active",
      billing_period: billingPeriod,
      amount: Number(payment.amount) / 100,
      currency: payment.currency,
      payment_gateway: "razorpay",
      payment_gateway_subscription_id: razorpay_payment_id,
      payment_gateway_customer_id: payment.email || user.email,
      current_period_start: currentPeriodStart.toISOString(),
      current_period_end: currentPeriodEnd.toISOString(),
      metadata: {
        razorpay_order_id,
        razorpay_payment_id,
        payment_method: payment.method,
      },
      updated_at: new Date().toISOString(),
    };

    const { data: existingSub } = await supabaseAdmin
      .from("subscriptions")
      .select("id")
      .eq("user_id", user.id)
      .single();

    let result;
    if (existingSub) {
      result = await supabaseAdmin
        .from("subscriptions")
        .update(subscriptionData)
        .eq("user_id", user.id)
        .select()
        .single();
    } else {
      result = await supabaseAdmin
        .from("subscriptions")
        .insert(subscriptionData)
        .select()
        .single();
    }

    if (result.error) {
      console.error("Subscription update error:", result.error);
      return NextResponse.json({ error: "Failed to update subscription" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      subscription: result.data,
      message: `Successfully subscribed to ${plan.name} plan`,
    });
  } catch (error: any) {
    console.error("Payment verification error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
