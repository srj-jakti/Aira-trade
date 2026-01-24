import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  serverErrorResponse,
  successResponse,
} from '@/lib/server/auth';

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedUser();
  if (!auth.authenticated) {
    return unauthorizedResponse();
  }

  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);
  const offset = (page - 1) * limit;

  try {
    const { data, error, count } = await supabaseAdmin
      .from('trade_history')
      .select('*', { count: 'exact' })
      .eq('user_id', auth.userId)
      .order('executed_at', { ascending: false })
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
