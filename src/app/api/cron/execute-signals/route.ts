/**
 * @deprecated
 * This cron-based signal execution route is redundant.
 * Signal execution is now handled reactively by the Railway 'trading-engine'.
 */
import { successResponse } from "@/lib/server/auth";

export async function GET() {
  return successResponse({ 
    success: true, 
    message: "This route is deprecated. Use the Railway trading-engine instead." 
  });
}
