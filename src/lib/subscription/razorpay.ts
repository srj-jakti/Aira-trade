import Razorpay from "razorpay";
import crypto from "crypto";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export { razorpay };

export interface CreateSubscriptionParams {
  planId: string;
  userId: string;
  userEmail: string;
  userName?: string;
  billingPeriod: "monthly" | "yearly";
}

export interface RazorpaySubscriptionResponse {
  id: string;
  plan_id: string;
  status: string;
  current_start: number;
  current_end: number;
  short_url: string;
}

export const RAZORPAY_PLAN_IDS = {
  basic: {
    monthly: process.env.RAZORPAY_BASIC_MONTHLY_PLAN_ID || "plan_basic_monthly",
    yearly: process.env.RAZORPAY_BASIC_YEARLY_PLAN_ID || "plan_basic_yearly",
  },
  pro: {
    monthly: process.env.RAZORPAY_PRO_MONTHLY_PLAN_ID || "plan_pro_monthly",
    yearly: process.env.RAZORPAY_PRO_YEARLY_PLAN_ID || "plan_pro_yearly",
  },
  elite: {
    monthly: process.env.RAZORPAY_ELITE_MONTHLY_PLAN_ID || "plan_elite_monthly",
    yearly: process.env.RAZORPAY_ELITE_YEARLY_PLAN_ID || "plan_elite_yearly",
  },
} as const;

export function verifyWebhookSignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const text = `${orderId}|${paymentId}`;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(text)
    .digest("hex");
  return expectedSignature === signature;
}

export async function createOrder(
  amount: number,
  currency: string,
  receipt: string,
  notes: Record<string, string>
) {
  return razorpay.orders.create({
    amount: amount * 100,
    currency,
    receipt,
    notes,
  });
}

export async function createSubscription(
  planId: string,
  totalCount: number,
  customerNotify: number,
  notes: Record<string, string>
) {
  return razorpay.subscriptions.create({
    plan_id: planId,
    total_count: totalCount,
    customer_notify: customerNotify,
    notes,
  });
}

export async function cancelSubscription(subscriptionId: string) {
  return razorpay.subscriptions.cancel(subscriptionId);
}

export async function fetchSubscription(subscriptionId: string) {
  return razorpay.subscriptions.fetch(subscriptionId);
}
