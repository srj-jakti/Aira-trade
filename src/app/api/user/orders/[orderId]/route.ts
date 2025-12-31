import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  badRequestResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { tradeExecutionEngine } from "@/lib/server/trade-execution-engine";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated || !user.userId) return unauthorizedResponse();

  const { orderId } = await params;

  try {
    const body = await request.json();
    const { quantity, price, triggerPrice, orderType } = body;

    const result = await tradeExecutionEngine.modifyOrder(user.userId, orderId, {
      quantity,
      price,
      triggerPrice,
      orderType,
    });

    return successResponse(result);
  } catch (error) {
    console.error("Error modifying order:", error);
    return serverErrorResponse();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated || !user.userId) return unauthorizedResponse();

  const { orderId } = await params;

  try {
    const result = await tradeExecutionEngine.cancelOrder(user.userId, orderId);
    return successResponse(result);
  } catch (error) {
    console.error("Error cancelling order:", error);
    return serverErrorResponse();
  }
}
