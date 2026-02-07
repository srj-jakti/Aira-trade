import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  forbiddenResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ strategyId: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated) return unauthorizedResponse();

  try {
    const { strategyId } = await params;
    const id = parseInt(strategyId);
    const body = await request.json();
    const { active } = body;

    const { data: strategyData, error: strategyError } = await supabaseAdmin
      .from("strategies")
      .select(
        [
          "id",
          "user_id",
          "is_finalized",
          "visibility",
          "admin_approved",
          "name",
          "description",
          "raw_input",
          "buy_entry_logic",
          "buy_stop_loss",
          "buy_target",
          "buy_trailing_sl",
          "sell_entry_logic",
          "sell_stop_loss",
          "sell_target",
          "sell_trailing_sl",
          "hold_logic",
          "executable_strategy",
          "zairoth_intent",
          "selected_timeframes",
          "selected_instruments",
          "is_paper_trading",
          "ai_analysis_enabled",
          "category"
        ].join(",")
      )
      .eq("id", id)
      .single();

    if (strategyError) {
      return serverErrorResponse(strategyError.message);
    }

    const strategy = strategyData as any;

    if (!strategy) {
      return Response.json({ error: "Strategy not found" }, { status: 404 });
    }

    if (strategy.user_id === user.userId) {
      if (active && !strategy.is_finalized) {
        await supabaseAdmin
          .from("strategies")
          .update({
            is_finalized: true,
            status: "finalized",
            updated_at: new Date().toISOString(),
          })
          .eq("id", id);
      }

      await supabaseAdmin
        .from("strategies")
        .update({ is_active: active, updated_at: new Date().toISOString() })
        .eq("id", id);

      return successResponse({
        message: active ? "Strategy activated" : "Strategy deactivated",
        is_active: active,
        strategy_id: id,
      });
    }

    const canFork = await canUserForkStrategy(
      {
        id,
        visibility: strategy.visibility,
        admin_approved: strategy.admin_approved,
      },
      user.userId!
    );
    if (!canFork) return forbiddenResponse();

    const forkId = await getOrCreateStrategyFork(strategy, user.userId!);

    if (!forkId && !active) {
      return successResponse({
        message: "Strategy deactivated",
        is_active: false,
        forked: true,
      });
    }

    await supabaseAdmin
      .from("strategies")
      .update({ is_active: active, updated_at: new Date().toISOString() })
      .eq("id", forkId);

    return successResponse({
      message: active ? "Strategy activated" : "Strategy deactivated",
      is_active: active,
      forked: true,
      strategy_id: forkId,
    });
  } catch (error) {
    console.error("Error toggling strategy activation:", error);
    return serverErrorResponse();
  }
}

async function canUserForkStrategy(
  strategy: { id: number; visibility: string; admin_approved: boolean | null },
  userId: string
): Promise<boolean> {
  if (strategy.visibility === "public") {
    return strategy.admin_approved === true;
  }

  if (strategy.visibility === "invite_only") {
    return await checkUserAccess(strategy.id, userId);
  }

  return false;
}

async function checkUserAccess(strategyId: number, userId: string): Promise<boolean> {
  const { data: grant } = await supabaseAdmin
    .from("strategy_access_grants")
    .select("id, expires_at, is_revoked")
    .eq("strategy_id", strategyId)
    .eq("user_id", userId)
    .single();

  if (grant && !grant.is_revoked) {
    if (!grant.expires_at || new Date(grant.expires_at) > new Date()) {
      return true;
    }
  }

  return false;
}

async function getOrCreateStrategyFork(
  sourceStrategy: Record<string, any>,
  userId: string
): Promise<number> {
  const { data: existing } = await supabaseAdmin
    .from("strategy_forks")
    .select("fork_strategy_id")
    .eq("source_strategy_id", sourceStrategy.id)
    .eq("user_id", userId)
    .single();

  if (existing?.fork_strategy_id) {
    return existing.fork_strategy_id;
  }

  const forkName =
    typeof sourceStrategy.name === "string" && sourceStrategy.name.length > 0
      ? `${sourceStrategy.name} (Copy)`
      : "Strategy Copy";

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("strategies")
    .insert({
      user_id: userId,
      name: forkName,
      description: sourceStrategy.description ?? null,
      raw_input: sourceStrategy.raw_input ?? null,
      visibility: "private",
      is_active: false,
      is_finalized: true,
      status: "finalized",
      admin_approved: false,
      selected_timeframes: sourceStrategy.selected_timeframes ?? [],
      selected_instruments: sourceStrategy.selected_instruments ?? [],
      is_paper_trading: sourceStrategy.is_paper_trading ?? true,
      ai_analysis_enabled: sourceStrategy.ai_analysis_enabled ?? false,
      buy_entry_logic: sourceStrategy.buy_entry_logic ?? { conditions: [] },
      buy_stop_loss: sourceStrategy.buy_stop_loss ?? { conditions: [] },
      buy_target: sourceStrategy.buy_target ?? { conditions: [] },
      buy_trailing_sl: sourceStrategy.buy_trailing_sl ?? { conditions: [] },
      sell_entry_logic: sourceStrategy.sell_entry_logic ?? { conditions: [] },
      sell_stop_loss: sourceStrategy.sell_stop_loss ?? { conditions: [] },
      sell_target: sourceStrategy.sell_target ?? { conditions: [] },
      sell_trailing_sl: sourceStrategy.sell_trailing_sl ?? { conditions: [] },
      hold_logic: sourceStrategy.hold_logic ?? { conditions: [] },
      executable_strategy: sourceStrategy.executable_strategy ?? null,
      zairoth_intent: sourceStrategy.zairoth_intent ?? null,
      category: sourceStrategy.category ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertError || !inserted?.id) {
    console.error("Strategy Copy Insert Error:", insertError);
    throw new Error("Failed to create strategy copy: " + (insertError?.message || "Unknown error"));
  }

  await supabaseAdmin.from("strategy_forks").insert({
    source_strategy_id: sourceStrategy.id,
    user_id: userId,
    fork_strategy_id: inserted.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  try {
    await supabaseAdmin.from("strategy_versions").insert({
      strategy_id: inserted.id,
      version: 1,
      buy_entry_logic: sourceStrategy.buy_entry_logic ?? { conditions: [] },
      buy_stop_loss: sourceStrategy.buy_stop_loss ?? { conditions: [] },
      buy_target: sourceStrategy.buy_target ?? { conditions: [] },
      buy_trailing_sl: sourceStrategy.buy_trailing_sl ?? { conditions: [] },
      sell_entry_logic: sourceStrategy.sell_entry_logic ?? { conditions: [] },
      sell_stop_loss: sourceStrategy.sell_stop_loss ?? { conditions: [] },
      sell_target: sourceStrategy.sell_target ?? { conditions: [] },
      sell_trailing_sl: sourceStrategy.sell_trailing_sl ?? { conditions: [] },
      hold_logic: sourceStrategy.hold_logic ?? { conditions: [] },
    });
  } catch (err) {
    console.warn("Failed to create initial version for fork:", err);
  }

  return inserted.id;
}
