import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { aiSharedService } from "@/lib/server/ai-shared-service";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated) return unauthorizedResponse();

  const searchParams = request.nextUrl.searchParams;
  const instrumentToken = searchParams.get("instrument");

  try {
    const signals = await aiSharedService.getActiveSignals(
      instrumentToken ? parseInt(instrumentToken) : undefined
    );

    return successResponse({ signals });
  } catch (error) {
    console.error("Error fetching AI signals:", error);
    return serverErrorResponse();
  }
}
