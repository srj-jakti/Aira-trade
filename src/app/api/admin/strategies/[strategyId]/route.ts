import { NextRequest } from "next/server";
import {
  getAdminUser,
  unauthorizedResponse,
  forbiddenResponse,
  badRequestResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ strategyId: string }> }
) {
  const admin = await getAdminUser();
  if (!admin.authenticated) return unauthorizedResponse();
  if (!admin.isAdmin) return forbiddenResponse();

  try {
    const { strategyId } = await params;
    const id = parseInt(strategyId);
    const body = await request.json();
    const { action } = body;

    if (!["approve", "reject"].includes(action)) {
      return badRequestResponse("Invalid action");
    }

    const { data: strategy } = await supabaseAdmin
      .from("strategies")
      .select("id, visibility")
      .eq("id", id)
      .single();

    if (!strategy) {
      return Response.json({ error: "Strategy not found" }, { status: 404 });
    }

    if (strategy.visibility === "private") {
      return badRequestResponse("Cannot approve private strategies");
    }

    if (action === "approve") {
      await supabaseAdmin
        .from("strategies")
        .update({
          admin_approved: true,
          admin_approved_at: new Date().toISOString(),
          admin_approved_by: admin.userId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      return successResponse({ message: "Strategy approved" });
    }

    if (action === "reject") {
      await supabaseAdmin
        .from("strategies")
        .update({
          admin_approved: false,
          visibility: "private",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      return successResponse({ message: "Strategy rejected and set to private" });
    }

    return badRequestResponse("Invalid action");
  } catch (error) {
    console.error("Error processing admin action:", error);
    return serverErrorResponse();
  }
}
