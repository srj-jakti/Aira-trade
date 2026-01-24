import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { 
  getAuthenticatedUser, 
  unauthorizedResponse, 
  badRequestResponse, 
  serverErrorResponse,
  successResponse 
} from '@/lib/server/auth';
import { encrypt, decrypt, maskCredential } from '@/lib/server/encryption';
import { credentialsSchema } from '@/lib/validations';
import { logAudit } from '@/lib/server/audit';

// GET - Retrieve masked credentials
export async function GET() {
  const auth = await getAuthenticatedUser();
  if (!auth.authenticated) {
    return unauthorizedResponse();
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('user_config')
      .select('config')
      .eq('user_id', auth.userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      return serverErrorResponse();
    }

    if (!data?.config) {
      return successResponse({ credentials: {} });
    }

    // Decrypt and mask all credential values
    const config = data.config as Record<string, string>;
    const masked: Record<string, string> = {};

    for (const [key, value] of Object.entries(config)) {
      if (value && typeof value === 'string') {
        try {
          const decrypted = decrypt(value);
          masked[key] = maskCredential(decrypted);
        } catch {
          masked[key] = '****';
        }
      }
    }

    return successResponse({ credentials: masked });
  } catch {
    return serverErrorResponse();
  }
}

// POST - Save/update credentials
export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser();
  if (!auth.authenticated) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const validation = credentialsSchema.safeParse(body);

    if (!validation.success) {
      return badRequestResponse('Invalid credentials format', validation.error.flatten());
    }

    // Encrypt all credential values
    const encryptedConfig: Record<string, string> = {};
    for (const [key, value] of Object.entries(validation.data)) {
      if (value && typeof value === 'string' && value.trim()) {
        encryptedConfig[key] = encrypt(value);
      }
    }

    // Get existing config to merge
    const { data: existing } = await supabaseAdmin
      .from('user_config')
      .select('config')
      .eq('user_id', auth.userId)
      .single();

    const mergedConfig = {
      ...(existing?.config || {}),
      ...encryptedConfig,
    };

    const { error } = await supabaseAdmin
      .from('user_config')
      .upsert({
        user_id: auth.userId,
        config: mergedConfig,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

    if (error) {
      return serverErrorResponse();
    }

    await logAudit({
      user_id: auth.userId!,
      action: existing ? 'credential_updated' : 'credential_created',
      target_table: 'user_config',
      metadata: { keys_updated: Object.keys(validation.data) },
    });

    return successResponse({ success: true });
  } catch {
    return serverErrorResponse();
  }
}

// DELETE - Remove specific credentials
export async function DELETE(request: NextRequest) {
  const auth = await getAuthenticatedUser();
  if (!auth.authenticated) {
    return unauthorizedResponse();
  }

  try {
    const { keys } = await request.json();
    
    if (!Array.isArray(keys) || keys.length === 0) {
      return badRequestResponse('Keys array required');
    }

    const { data: existing } = await supabaseAdmin
      .from('user_config')
      .select('config')
      .eq('user_id', auth.userId)
      .single();

    if (!existing?.config) {
      return successResponse({ success: true });
    }

    const updatedConfig = { ...existing.config };
    for (const key of keys) {
      delete updatedConfig[key];
    }

    const { error } = await supabaseAdmin
      .from('user_config')
      .update({
        config: updatedConfig,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', auth.userId);

    if (error) {
      return serverErrorResponse();
    }

    await logAudit({
      user_id: auth.userId!,
      action: 'credential_deleted',
      target_table: 'user_config',
      metadata: { keys_deleted: keys },
    });

    return successResponse({ success: true });
  } catch {
    return serverErrorResponse();
  }
}
