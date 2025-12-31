import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  badRequestResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { tradeExecutionEngine } from "@/lib/server/trade-execution-engine";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user.authenticated || !user.userId) return unauthorizedResponse();

  try {
    const { data: orders } = await supabaseAdmin
      .from("user_orders")
      .select("*")
      .eq("user_id", user.userId)
      .order("created_at", { ascending: false })
      .limit(100);

    return successResponse({ orders: orders || [] });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return serverErrorResponse();
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated || !user.userId) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { tradingsymbol, exchange, transactionType, orderType, product, quantity, price, triggerPrice, strategyId } = body;

    if (!tradingsymbol || !exchange || !transactionType || !orderType || !product || !quantity) {
      return badRequestResponse("Missing required order parameters");
    }

    const result = await tradeExecutionEngine.placeOrder(
      user.userId,
      {
        tradingsymbol,
        exchange,
        transactionType,
        orderType,
        product,
        quantity,
        price,
        triggerPrice,
      },
      strategyId
    );

    return successResponse(result);
  } catch (error) {
    console.error("Error placing order:", error);
    return serverErrorResponse();
  }
}
