import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/subscription/razorpay";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const signature = request.headers.get("x-razorpay-signature");
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!signature || !webhookSecret) {
      return NextResponse.json({ error: "Missing signature or secret" }, { status: 400 });
    }

    const isValid = verifyWebhookSignature(body, signature, webhookSecret);
    if (!isValid) {
      console.error("Invalid webhook signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(body);
    const eventType = event.event;

    console.log("Razorpay webhook received:", eventType);

    switch (eventType) {
      case "payment.captured": {
        const payment = event.payload.payment.entity;
        const userId = payment.notes?.user_id;
        
        if (userId) {
          await supabaseAdmin
            .from("subscriptions")
            .update({
              status: "active",
              metadata: {
                last_payment_id: payment.id,
                last_payment_at: new Date().toISOString(),
              },
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId)
            .eq("payment_gateway", "razorpay");
        }
        break;
      }

      case "payment.failed": {
        const payment = event.payload.payment.entity;
        const userId = payment.notes?.user_id;
        
        if (userId) {
          await supabaseAdmin
            .from("subscriptions")
            .update({
              status: "payment_failed",
              metadata: {
                last_failed_payment_id: payment.id,
                failure_reason: payment.error_description,
                failed_at: new Date().toISOString(),
              },
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId)
            .eq("payment_gateway", "razorpay");
        }
        break;
      }

      case "subscription.activated": {
        const subscription = event.payload.subscription.entity;
        const userId = subscription.notes?.user_id;
        
        if (userId) {
          await supabaseAdmin
            .from("subscriptions")
            .update({
              status: "active",
              payment_gateway_subscription_id: subscription.id,
              current_period_start: new Date(subscription.current_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_end * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId)
            .eq("payment_gateway", "razorpay");
        }
        break;
      }

      case "subscription.cancelled": {
        const subscription = event.payload.subscription.entity;
        const userId = subscription.notes?.user_id;
        
        if (userId) {
          await supabaseAdmin
            .from("subscriptions")
            .update({
              status: "cancelled",
              canceled_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId)
            .eq("payment_gateway", "razorpay");
        }
        break;
      }

      case "subscription.charged": {
        const subscription = event.payload.subscription.entity;
        const userId = subscription.notes?.user_id;
        
        if (userId) {
          await supabaseAdmin
            .from("subscriptions")
            .update({
              status: "active",
              current_period_start: new Date(subscription.current_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_end * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId)
            .eq("payment_gateway", "razorpay");
        }
        break;
      }

      case "refund.processed": {
        const refund = event.payload.refund.entity;
        const payment = event.payload.payment?.entity;
        const userId = payment?.notes?.user_id;
        
        if (userId) {
          await supabaseAdmin
            .from("subscriptions")
            .update({
              status: "refunded",
              metadata: {
                refund_id: refund.id,
                refund_amount: refund.amount / 100,
                refunded_at: new Date().toISOString(),
              },
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId)
            .eq("payment_gateway", "razorpay");
        }
        break;
      }

      default:
        console.log("Unhandled webhook event:", eventType);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
