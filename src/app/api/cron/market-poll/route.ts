/**
 * @deprecated
 * This polling-based market data route is redundant.
 * Market data is now handled via WebSockets in the Railway 'market-data-worker'.
 */
import { successResponse } from "@/lib/server/auth";

export async function GET() {
  return successResponse({ 
    success: true, 
    message: "This route is deprecated. Use the Railway market-data-worker instead." 
  });
}
