import { supabase } from "./utils/supabase";

const MAX_ORDERS_PER_MINUTE = 10;
const MAX_EVALUATIONS_PER_MINUTE = 20;

function getMinuteWindow(): Date {
  const now = new Date();
  now.setSeconds(0, 0);
  return now;
}

export async function isRateLimited(userId: string): Promise<boolean> {
  const minuteWindow = getMinuteWindow();

  const { data } = await supabase
    .from("user_rate_limits")
    .select("order_count, evaluation_count")
    .eq("user_id", userId)
    .eq("minute_window", minuteWindow.toISOString())
    .single();

  if (!data) return false;

  return data.evaluation_count >= MAX_EVALUATIONS_PER_MINUTE;
}

export async function isOrderRateLimited(userId: string): Promise<boolean> {
  const minuteWindow = getMinuteWindow();

  const { data } = await supabase
    .from("user_rate_limits")
    .select("order_count")
    .eq("user_id", userId)
    .eq("minute_window", minuteWindow.toISOString())
    .single();

  if (!data) return false;

  return data.order_count >= MAX_ORDERS_PER_MINUTE;
}

export async function incrementRateLimit(
  userId: string,
  type: "order" | "evaluation"
): Promise<void> {
  const minuteWindow = getMinuteWindow();

  const { data: existing } = await supabase
    .from("user_rate_limits")
    .select("id, order_count, evaluation_count")
    .eq("user_id", userId)
    .eq("minute_window", minuteWindow.toISOString())
    .single();

  if (existing) {
    const update: Record<string, number> = {};
    if (type === "order") {
      update.order_count = (existing.order_count || 0) + 1;
    } else {
      update.evaluation_count = (existing.evaluation_count || 0) + 1;
    }

    await supabase
      .from("user_rate_limits")
      .update(update)
      .eq("id", existing.id);
  } else {
    await supabase.from("user_rate_limits").insert({
      user_id: userId,
      minute_window: minuteWindow.toISOString(),
      order_count: type === "order" ? 1 : 0,
      evaluation_count: type === "evaluation" ? 1 : 0,
    });
  }
}
