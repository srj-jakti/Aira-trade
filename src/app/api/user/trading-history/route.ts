import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { paginationSchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedUser();
  if (!auth.authenticated) {
    return unauthorizedResponse();
  }

  const searchParams = request.nextUrl.searchParams;
  const validation = paginationSchema.safeParse({
    page: searchParams.get("page"),
    limit: searchParams.get("limit"),
  });

  const page = validation.success ? validation.data.page : 1;
  const limit = validation.success ? Math.min(validation.data.limit, 100) : 10;
  const offset = (page - 1) * limit;

  try {
    const { data, error, count } = await supabaseAdmin
      .from("trade_history")
      .select("*", { count: "exact" })
      .eq("user_id", auth.userId)
      .order("executed_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return serverErrorResponse();
    }

    return successResponse({
      trades: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch {
    return serverErrorResponse();
  }
}
