import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  forbiddenResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { strategyService } from "@/lib/server/strategy-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ strategyId: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated) return unauthorizedResponse();

  try {
    const { strategyId } = await params;
    const id = parseInt(strategyId);

    const hasAccess = await strategyService.checkAccess(id, user.userId!);
    if (!hasAccess) return forbiddenResponse();

    const { data: strategy } = await supabaseAdmin
      .from("strategies")
      .select("*")
      .eq("id", id)
      .single();

    if (!strategy) {
      return Response.json({ error: "Strategy not found" }, { status: 404 });
    }

      const isOwner = strategy.user_id === user.userId;
      return successResponse({ strategy, hasFullAccess: true, isOwner });
  } catch (error) {
    console.error("Error fetching strategy:", error);
    return serverErrorResponse();
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ strategyId: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated) return unauthorizedResponse();

  try {
    const { strategyId } = await params;
    const id = parseInt(strategyId);
    const body = await request.json();

    const { data: existing } = await supabaseAdmin
      .from("strategies")
      .select("user_id")
      .eq("id", id)
      .single();

    if (!existing || existing.user_id !== user.userId) {
      return forbiddenResponse();
    }

    const { error } = await supabaseAdmin
      .from("strategies")
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) throw error;

    return successResponse({ message: "Strategy updated" });
  } catch (error) {
    console.error("Error updating strategy:", error);
    return serverErrorResponse();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ strategyId: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated) return unauthorizedResponse();

  try {
    const { strategyId } = await params;
    const id = parseInt(strategyId);

    const { data: existing } = await supabaseAdmin
      .from("strategies")
      .select("user_id")
      .eq("id", id)
      .single();

    if (!existing || existing.user_id !== user.userId) {
      return forbiddenResponse();
    }

    await supabaseAdmin.from("strategies").delete().eq("id", id);

    return successResponse({ message: "Strategy deleted" });
  } catch (error) {
    console.error("Error deleting strategy:", error);
    return serverErrorResponse();
  }
}
