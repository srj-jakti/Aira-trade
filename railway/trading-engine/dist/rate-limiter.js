"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRateLimited = isRateLimited;
exports.isOrderRateLimited = isOrderRateLimited;
exports.incrementRateLimit = incrementRateLimit;
const supabase_1 = require("./utils/supabase");
const MAX_ORDERS_PER_MINUTE = 10;
const MAX_EVALUATIONS_PER_MINUTE = 20;
function getMinuteWindow() {
    const now = new Date();
    now.setSeconds(0, 0);
    return now;
}
async function isRateLimited(userId) {
    const minuteWindow = getMinuteWindow();
    const { data } = await supabase_1.supabase
        .from("user_rate_limits")
        .select("order_count, evaluation_count")
        .eq("user_id", userId)
        .eq("minute_window", minuteWindow.toISOString())
        .single();
    if (!data)
        return false;
    return data.evaluation_count >= MAX_EVALUATIONS_PER_MINUTE;
}
async function isOrderRateLimited(userId) {
    const minuteWindow = getMinuteWindow();
    const { data } = await supabase_1.supabase
        .from("user_rate_limits")
        .select("order_count")
        .eq("user_id", userId)
        .eq("minute_window", minuteWindow.toISOString())
        .single();
    if (!data)
        return false;
    return data.order_count >= MAX_ORDERS_PER_MINUTE;
}
async function incrementRateLimit(userId, type) {
    const minuteWindow = getMinuteWindow();
    const { data: existing } = await supabase_1.supabase
        .from("user_rate_limits")
        .select("id, order_count, evaluation_count")
        .eq("user_id", userId)
        .eq("minute_window", minuteWindow.toISOString())
        .single();
    if (existing) {
        const update = {};
        if (type === "order") {
            update.order_count = (existing.order_count || 0) + 1;
        }
        else {
            update.evaluation_count = (existing.evaluation_count || 0) + 1;
        }
        await supabase_1.supabase
            .from("user_rate_limits")
            .update(update)
            .eq("id", existing.id);
    }
    else {
        await supabase_1.supabase.from("user_rate_limits").insert({
            user_id: userId,
            minute_window: minuteWindow.toISOString(),
            order_count: type === "order" ? 1 : 0,
            evaluation_count: type === "evaluation" ? 1 : 0,
        });
    }
}
//# sourceMappingURL=rate-limiter.js.map