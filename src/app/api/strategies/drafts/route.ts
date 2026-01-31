import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  badRequestResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(_request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated) return unauthorizedResponse();

  try {
    const { data, error } = await supabaseAdmin
      .from("strategy_drafts")
      .select("*")
      .eq("user_id", user.userId)
      .order("updated_at", { ascending: false });

    if (error) throw error;

    return successResponse({ drafts: data || [] });
  } catch (error) {
    console.error("Error fetching drafts:", error);
    return serverErrorResponse("Failed to fetch drafts");
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated) return unauthorizedResponse();

  try {
    const body = await request.json();
    const {
      draftId,
      name,
      description,
      rawInput,
      strategyData,
      selectedInstruments,
      selectedTimeframes,
      backtestResults,
      step,
    } = body;

    if (draftId) {
      const { data, error } = await supabaseAdmin
        .from("strategy_drafts")
        .update({
          name: name || strategyData?.name,
          description: description || strategyData?.description,
          raw_input: rawInput,
          strategy_data: strategyData,
          selected_instruments: selectedInstruments,
          selected_timeframes: selectedTimeframes,
          backtest_results: backtestResults,
          step,
          updated_at: new Date().toISOString(),
        })
        .eq("id", draftId)
        .eq("user_id", user.userId)
        .select()
        .single();

      if (error) throw error;
      return successResponse({ draft: data });
    }

    const { data, error } = await supabaseAdmin
      .from("strategy_drafts")
      .insert({
        user_id: user.userId,
        name: name || strategyData?.name || "Untitled Draft",
        description: description || strategyData?.description,
        raw_input: rawInput,
        strategy_data: strategyData,
        selected_instruments: selectedInstruments,
        selected_timeframes: selectedTimeframes,
        backtest_results: backtestResults,
        step: step || "input",
      })
      .select()
      .single();

    if (error) throw error;
    return successResponse({ draft: data });
  } catch (error) {
    console.error("Error saving draft:", error);
    return serverErrorResponse("Failed to save draft");
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const draftId = searchParams.get("id");

    if (!draftId) {
      return badRequestResponse("Draft ID is required");
    }

    const { error } = await supabaseAdmin
      .from("strategy_drafts")
      .delete()
      .eq("id", draftId)
      .eq("user_id", user.userId);

    if (error) throw error;
    return successResponse({ deleted: true });
  } catch (error) {
    console.error("Error deleting draft:", error);
    return serverErrorResponse("Failed to delete draft");
  }
}
