import {
  getAdminUser,
  unauthorizedResponse,
  forbiddenResponse,
  successResponse,
  errorResponse,
} from "@/lib/server/auth";
import {
  refreshDynamicSubscriptions,
  getSubscriptionStats,
} from "@/lib/server/dynamic-instrument-manager";

export async function GET() {
  const admin = await getAdminUser();
  if (!admin.authenticated) {
    return unauthorizedResponse();
  }
  if (!admin.isAdmin) {
    return forbiddenResponse();
  }

  try {
    const stats = await getSubscriptionStats();
    return successResponse({ stats });
  } catch (error) {
    console.error("Error getting subscription stats:", error);
    return errorResponse("Failed to get subscription stats");
  }
}

export async function POST() {
  const admin = await getAdminUser();
  if (!admin.authenticated) {
    return unauthorizedResponse();
  }
  if (!admin.isAdmin) {
    return forbiddenResponse();
  }

  try {
    const result = await refreshDynamicSubscriptions();
    return successResponse(result);
  } catch (error) {
    console.error("Error refreshing subscriptions:", error);
    return errorResponse("Failed to refresh subscriptions");
  }
}
