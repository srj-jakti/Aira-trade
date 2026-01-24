import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  getAdminUser,
  unauthorizedResponse,
  forbiddenResponse,
  badRequestResponse,
  serverErrorResponse,
  successResponse,
} from '@/lib/server/auth';
import { uuidSchema } from '@/lib/validations';
import { logAudit } from '@/lib/server/audit';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const admin = await getAdminUser();
  if (!admin.authenticated) {
    return unauthorizedResponse();
  }
  if (!admin.isAdmin) {
    return forbiddenResponse('Admin access required');
  }

  const { userId } = await params;
  const validation = uuidSchema.safeParse(userId);
  if (!validation.success) {
    return badRequestResponse('Invalid user ID');
  }

  try {
    // Delete in order with error tracking
    const tables = [
      'strategies',
      'trading_preferences', 
      'user_config',
      'subscriptions',
      'trade_history',
      'ai_analysis',
      'profiles',
    ];

    const errors: string[] = [];

    for (const table of tables) {
      const { error } = await supabaseAdmin
        .from(table)
        .delete()
        .eq(table === 'profiles' ? 'id' : 'user_id', userId);

      if (error && error.code !== 'PGRST116') {
        errors.push(`${table}: ${error.message}`);
      }
    }

    if (errors.length > 0) {
      console.error('Delete user errors:', errors);
      return serverErrorResponse();
    }

    await logAudit({
      user_id: admin.userId!,
      action: 'admin_user_deleted',
      target_table: 'profiles',
      target_id: userId,
    });

    return successResponse({ success: true });
  } catch {
    return serverErrorResponse();
  }
}
