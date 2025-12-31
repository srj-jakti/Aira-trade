# AiRA Trading Platform - Secure Hybrid Architecture Refactor Guide

## OVERVIEW

This document defines the complete architectural transformation from a client-heavy Supabase application to a secure hybrid architecture where:

- **Supabase** = Auth, Database, Storage, Realtime (data persistence layer)
- **Vercel/Next.js Backend** = Authority layer (validation, encryption, business logic, security)

---

## ARCHITECTURAL PRINCIPLES (PERMANENT)

These principles apply to ALL current and future code:

### 1. Data Sensitivity Classification

```
LEVEL 1 - PUBLIC: Landing page content, public marketing data
LEVEL 2 - USER-OWNED: Profile, preferences, own trading history
LEVEL 3 - SENSITIVE: API credentials, financial limits, strategies
LEVEL 4 - SYSTEM: Admin config, cross-user data, global settings
```

### 2. Access Rules by Level

| Level | Client Access | Server Access | Storage |
|-------|---------------|---------------|---------|
| LEVEL 1 | ✅ Direct read | ✅ Full | Plain |
| LEVEL 2 | ✅ Own data only | ✅ Full | Plain |
| LEVEL 3 | ❌ Never | ✅ Full | Encrypted |
| LEVEL 4 | ❌ Never | ✅ Admin only | Encrypted |

### 3. Future-Proofing Rule

**When adding ANY new feature, ask:**
1. What data level is this? (1-4)
2. Does it involve credentials or financial data? → Backend only
3. Does it cross user boundaries? → Backend only
4. Is it read-only user data? → Client may access with RLS

---

## TARGET ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                          │
│  ┌─────────────────┐  ┌──────────────────────────────────────┐  │
│  │ Supabase Client │  │     API Calls / Server Actions       │  │
│  │   (ANON KEY)    │  │                                      │  │
│  │                 │  │  - Credentials CRUD                  │  │
│  │  Allowed:       │  │  - Trading Controls                  │  │
│  │  - Auth         │  │  - Admin Operations                  │  │
│  │  - Own profile  │  │  - Financial Settings                │  │
│  │  - Own history  │  │  - Cross-user Queries                │  │
│  │    (read)       │  │  - Aggregations                      │  │
│  └────────┬────────┘  └──────────────────┬───────────────────┘  │
│           │                              │                       │
└───────────┼──────────────────────────────┼───────────────────────┘
            │                              │
            ▼                              ▼
┌───────────────────────┐    ┌─────────────────────────────────────┐
│   Supabase (Direct)   │    │     Vercel Backend (API Routes)     │
│                       │    │                                     │
│   - RLS enforced      │    │  ┌─────────────────────────────┐   │
│   - User-scoped only  │    │  │  Authorization Middleware   │   │
│                       │    │  │  - Session validation       │   │
│                       │    │  │  - Admin verification       │   │
│                       │    │  │  - Rate limiting            │   │
│                       │    │  └──────────────┬──────────────┘   │
│                       │    │                 │                   │
│                       │    │  ┌──────────────▼──────────────┐   │
│                       │    │  │  Validation Layer (Zod)     │   │
│                       │    │  │  - Input sanitization       │   │
│                       │    │  │  - Type enforcement         │   │
│                       │    │  │  - Range validation         │   │
│                       │    │  └──────────────┬──────────────┘   │
│                       │    │                 │                   │
│                       │    │  ┌──────────────▼──────────────┐   │
│                       │    │  │  Business Logic             │   │
│                       │    │  │  - Encryption/Decryption    │   │
│                       │    │  │  - State transitions        │   │
│                       │    │  │  - Audit logging            │   │
│                       │    │  └──────────────┬──────────────┘   │
│                       │    │                 │                   │
│                       │    │  ┌──────────────▼──────────────┐   │
│                       │    │  │  Supabase Admin Client      │   │
│                       │    │  │  (SERVICE_ROLE_KEY)         │   │
│                       │    │  │  - Bypasses RLS             │   │
│                       │    │  │  - Full table access        │   │
│                       │    │  └──────────────┬──────────────┘   │
│                       │    │                 │                   │
└───────────┬───────────┘    └─────────────────┼───────────────────┘
            │                                  │
            ▼                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase PostgreSQL                           │
│                                                                  │
│   Tables with RLS (User Access)    Tables without RLS (Admin)   │
│   ├── profiles                     ├── app_config               │
│   ├── trading_preferences (read)   ├── admin_users              │
│   ├── trade_history (read)         ├── user_config (encrypted)  │
│   ├── ai_analysis (read)           ├── subscriptions            │
│   └── strategies (read)            └── audit_logs               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## IMPLEMENTATION PHASES

### PHASE 0: FOUNDATION SETUP
**Priority: CRITICAL | Must complete first**

#### Step 0.1: Environment Variables

Add to `.env.local`:
```env
# Existing
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# NEW - Required for encryption
ENCRYPTION_KEY=<generate-32-byte-hex-key>
```

Generate encryption key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Step 0.2: Create Admin Supabase Client

**File: `src/lib/supabase/admin.ts`**

```typescript
import { createClient } from '@supabase/supabase-js';

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
}

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);
```

**RULE: This file may ONLY be imported in:**
- `src/app/api/**/*.ts`
- `src/app/**/actions.ts`
- `src/lib/server/**/*.ts`

**NEVER import in:**
- Any file with `'use client'`
- Any component file

#### Step 0.3: Create Encryption Utility

**File: `src/lib/server/encryption.ts`**

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
  }
  return Buffer.from(key, 'hex');
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(ciphertext: string): string {
  const [ivHex, authTagHex, encrypted] = ciphertext.split(':');
  
  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error('Invalid encrypted format');
  }
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

export function maskCredential(value: string, visibleChars = 4): string {
  if (!value || value.length <= visibleChars) {
    return '****';
  }
  return '*'.repeat(value.length - visibleChars) + value.slice(-visibleChars);
}
```

#### Step 0.4: Create Validation Schemas

**File: `src/lib/validations/index.ts`**

```typescript
import { z } from 'zod';

// Credential Schemas
export const credentialsSchema = z.object({
  zerodha_api_key: z.string().min(1).max(100).optional(),
  zerodha_api_secret: z.string().min(1).max(200).optional(),
  zerodha_access_token: z.string().max(500).optional(),
  openai_api_key: z.string().min(1).max(200).optional(),
  anthropic_api_key: z.string().min(1).max(200).optional(),
});

// Trading Settings Schemas
export const tradingSettingsSchema = z.object({
  ai_trading_enabled: z.boolean().optional(),
  max_daily_loss: z.number().min(0).max(100).optional(),
  max_position_size: z.number().min(0).max(100).optional(),
  max_daily_trades: z.number().min(1).max(1000).optional(),
  risk_per_trade: z.number().min(0.1).max(10).optional(),
  capital_allocation: z.number().min(0).optional(),
});

// Profile Schema
export const profileSchema = z.object({
  full_name: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).optional(),
  avatar_url: z.string().url().optional().nullable(),
});

// Admin Schemas
export const userApprovalSchema = z.object({
  userId: z.string().uuid(),
  approved: z.boolean(),
});

export const adminConfigSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string(),
  encrypted: z.boolean().default(false),
});

// Generic ID Schema
export const uuidSchema = z.string().uuid();
```

#### Step 0.5: Create Authorization Utilities

**File: `src/lib/server/auth.ts`**

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/admin';

export interface AuthResult {
  authenticated: boolean;
  userId: string | null;
  email: string | null;
  error?: string;
}

export interface AdminAuthResult extends AuthResult {
  isAdmin: boolean;
}

export async function getAuthenticatedUser(): Promise<AuthResult> {
  try {
    const cookieStore = await cookies();
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
        },
      }
    );

    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return { authenticated: false, userId: null, email: null, error: 'Not authenticated' };
    }

    return {
      authenticated: true,
      userId: user.id,
      email: user.email || null,
    };
  } catch (error) {
    return { authenticated: false, userId: null, email: null, error: 'Auth check failed' };
  }
}

export async function getAdminUser(): Promise<AdminAuthResult> {
  const authResult = await getAuthenticatedUser();
  
  if (!authResult.authenticated || !authResult.email) {
    return { ...authResult, isAdmin: false };
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('admin_users')
      .select('id')
      .eq('email', authResult.email)
      .single();

    if (error || !data) {
      return { ...authResult, isAdmin: false };
    }

    return { ...authResult, isAdmin: true };
  } catch {
    return { ...authResult, isAdmin: false };
  }
}

// Standard API response helpers
export function unauthorizedResponse(message = 'Unauthorized') {
  return Response.json({ error: message }, { status: 401 });
}

export function forbiddenResponse(message = 'Forbidden') {
  return Response.json({ error: message }, { status: 403 });
}

export function badRequestResponse(message: string, details?: unknown) {
  return Response.json({ error: message, details }, { status: 400 });
}

export function serverErrorResponse(message = 'Internal server error') {
  return Response.json({ error: message }, { status: 500 });
}

export function successResponse<T>(data: T, status = 200) {
  return Response.json(data, { status });
}
```

#### Step 0.6: Create Audit Logger

**File: `src/lib/server/audit.ts`**

```typescript
import { supabaseAdmin } from '@/lib/supabase/admin';

export type AuditAction =
  | 'credential_created'
  | 'credential_updated'
  | 'credential_deleted'
  | 'trading_enabled'
  | 'trading_disabled'
  | 'risk_settings_updated'
  | 'admin_user_approved'
  | 'admin_user_rejected'
  | 'admin_user_deleted'
  | 'admin_config_updated';

interface AuditLogEntry {
  user_id: string;
  action: AuditAction;
  target_table?: string;
  target_id?: string;
  metadata?: Record<string, unknown>;
  ip_address?: string;
}

export async function logAudit(entry: AuditLogEntry): Promise<void> {
  try {
    await supabaseAdmin.from('audit_logs').insert({
      ...entry,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    // Log to console but don't fail the operation
    console.error('Audit log failed:', error);
  }
}
```

---

### PHASE 1: CREDENTIAL SECURITY
**Priority: CRITICAL | Security Risk: Highest**

#### Step 1.1: Create Credentials API Route

**File: `src/app/api/credentials/route.ts`**

```typescript
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
```

#### Step 1.2: Refactor ApiKeysForm Component

**Replace direct Supabase calls with API calls**

The component should:
1. Remove all `@supabase/supabase-js` imports
2. Use `fetch('/api/credentials')` for all operations
3. Only display masked values
4. Never store or access raw credentials client-side

---

### PHASE 2: FINANCIAL CONTROLS
**Priority: HIGH | Security Risk: High**

#### Step 2.1: Create Trading Settings API Route

**File: `src/app/api/trading/settings/route.ts`**

```typescript
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  badRequestResponse,
  serverErrorResponse,
  successResponse,
} from '@/lib/server/auth';
import { tradingSettingsSchema } from '@/lib/validations';
import { logAudit } from '@/lib/server/audit';

// GET - Retrieve trading settings
export async function GET() {
  const auth = await getAuthenticatedUser();
  if (!auth.authenticated) {
    return unauthorizedResponse();
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('trading_preferences')
      .select('*')
      .eq('user_id', auth.userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      return serverErrorResponse();
    }

    return successResponse({ settings: data || {} });
  } catch {
    return serverErrorResponse();
  }
}

// POST - Update trading settings
export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser();
  if (!auth.authenticated) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const validation = tradingSettingsSchema.safeParse(body);

    if (!validation.success) {
      return badRequestResponse('Invalid settings', validation.error.flatten());
    }

    const { data: existing } = await supabaseAdmin
      .from('trading_preferences')
      .select('ai_trading_enabled')
      .eq('user_id', auth.userId)
      .single();

    const { error } = await supabaseAdmin
      .from('trading_preferences')
      .upsert({
        user_id: auth.userId,
        ...validation.data,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

    if (error) {
      return serverErrorResponse();
    }

    // Log trading state changes
    if (validation.data.ai_trading_enabled !== undefined && 
        existing?.ai_trading_enabled !== validation.data.ai_trading_enabled) {
      await logAudit({
        user_id: auth.userId!,
        action: validation.data.ai_trading_enabled ? 'trading_enabled' : 'trading_disabled',
        target_table: 'trading_preferences',
      });
    } else {
      await logAudit({
        user_id: auth.userId!,
        action: 'risk_settings_updated',
        target_table: 'trading_preferences',
        metadata: { fields_updated: Object.keys(validation.data) },
      });
    }

    return successResponse({ success: true });
  } catch {
    return serverErrorResponse();
  }
}
```

#### Step 2.2: Create Trading Toggle API Route

**File: `src/app/api/trading/toggle/route.ts`**

```typescript
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  badRequestResponse,
  serverErrorResponse,
  successResponse,
} from '@/lib/server/auth';
import { z } from 'zod';
import { logAudit } from '@/lib/server/audit';

const toggleSchema = z.object({
  enabled: z.boolean(),
});

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser();
  if (!auth.authenticated) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const validation = toggleSchema.safeParse(body);

    if (!validation.success) {
      return badRequestResponse('Invalid toggle value');
    }

    const { error } = await supabaseAdmin
      .from('trading_preferences')
      .upsert({
        user_id: auth.userId,
        ai_trading_enabled: validation.data.enabled,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

    if (error) {
      return serverErrorResponse();
    }

    await logAudit({
      user_id: auth.userId!,
      action: validation.data.enabled ? 'trading_enabled' : 'trading_disabled',
      target_table: 'trading_preferences',
    });

    return successResponse({ 
      success: true, 
      ai_trading_enabled: validation.data.enabled 
    });
  } catch {
    return serverErrorResponse();
  }
}
```

---

### PHASE 3: ADMIN HARDENING
**Priority: HIGH | Security Risk: High**

#### Step 3.1: Refactor Admin User Delete with Transaction

**File: `src/app/api/admin/users/[userId]/route.ts`**

```typescript
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
    // Use a database function for atomic deletion
    // If not available, delete in order with error tracking
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
```

---

### PHASE 4: USER DATA ACCESS PATTERNS
**Priority: MEDIUM | Optimization focus**

#### Step 4.1: Create User Data API Routes

**File: `src/app/api/user/trading-history/route.ts`**

```typescript
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
      .order('created_at', { ascending: false })
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
```

**File: `src/app/api/user/analysis-reports/route.ts`**

```typescript
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
  const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
  const offset = (page - 1) * limit;

  try {
    const { data, error, count } = await supabaseAdmin
      .from('ai_analysis')
      .select('*', { count: 'exact' })
      .eq('user_id', auth.userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return serverErrorResponse();
    }

    return successResponse({
      reports: data || [],
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
```

---

### PHASE 5: DATABASE SETUP
**Priority: HIGH | Required for security**

#### Step 5.1: RLS Policies (Simplified)

```sql
-- profiles: User can read/write own profile
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- trading_preferences: User can read own (write via backend)
ALTER TABLE trading_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own preferences" ON trading_preferences;

CREATE POLICY "Users can view own preferences" ON trading_preferences
  FOR SELECT USING (auth.uid() = user_id);

-- user_config: NO CLIENT ACCESS (encrypted credentials)
ALTER TABLE user_config ENABLE ROW LEVEL SECURITY;
-- No policies = no client access

-- trade_history: User can read own
ALTER TABLE trade_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own trades" ON trade_history;

CREATE POLICY "Users can view own trades" ON trade_history
  FOR SELECT USING (auth.uid() = user_id);

-- ai_analysis: User can read own
ALTER TABLE ai_analysis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own analysis" ON ai_analysis;

CREATE POLICY "Users can view own analysis" ON ai_analysis
  FOR SELECT USING (auth.uid() = user_id);

-- strategies: User can read/write own
ALTER TABLE strategies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own strategies" ON strategies;

CREATE POLICY "Users can manage own strategies" ON strategies
  FOR ALL USING (auth.uid() = user_id);

-- admin_users: NO CLIENT ACCESS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
-- No policies = no client access

-- app_config: NO CLIENT ACCESS
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
-- No policies = no client access

-- subscriptions: NO CLIENT ACCESS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
-- No policies = no client access
```

#### Step 5.2: Create Audit Log Table

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  target_table TEXT,
  target_id TEXT,
  metadata JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying by user and time
CREATE INDEX idx_audit_logs_user_time ON audit_logs(user_id, created_at DESC);

-- No RLS - only backend can write
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
```

---

### PHASE 6: CLIENT COMPONENT REFACTORING
**Priority: MEDIUM | After backend is ready**

#### Refactoring Checklist for Each Component

For each settings component, apply this pattern:

```typescript
// BEFORE (Direct Supabase)
const supabase = createBrowserClient(...);
const { data } = await supabase.from('table').select('*');

// AFTER (API Call)
const response = await fetch('/api/endpoint');
const { data } = await response.json();
```

**Components to refactor:**
1. `ApiKeysForm.tsx` → `/api/credentials`
2. `RiskSettingsForm.tsx` → `/api/trading/settings`
3. `TradingHistory.tsx` → `/api/user/trading-history`
4. `AIAnalysisReports.tsx` → `/api/user/analysis-reports`

---

## FUTURE-PROOFING GUIDELINES

### Adding New Features Checklist

When adding ANY new feature:

```
□ Step 1: Classify data sensitivity (Level 1-4)
□ Step 2: If Level 3-4, create backend API first
□ Step 3: Add Zod validation schema
□ Step 4: Add audit logging if sensitive
□ Step 5: Update RLS only if Level 2 client read needed
□ Step 6: Create client component that calls API
□ Step 7: Test with unauthorized requests
```

### New Table Checklist

When adding a new database table:

```
□ Step 1: Determine if user-scoped or global
□ Step 2: If user-scoped, add user_id column with FK
□ Step 3: Enable RLS
□ Step 4: Add ONLY ownership-based SELECT policy (if client needs read)
□ Step 5: All writes go through backend API
□ Step 6: Add to TABLE ACCESS MATRIX above
```

### New API Route Template

```typescript
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  badRequestResponse,
  serverErrorResponse,
  successResponse,
} from '@/lib/server/auth';
import { z } from 'zod';
import { logAudit } from '@/lib/server/audit';

const requestSchema = z.object({
  // Define your schema
});

export async function POST(request: NextRequest) {
  // 1. Authenticate
  const auth = await getAuthenticatedUser();
  if (!auth.authenticated) {
    return unauthorizedResponse();
  }

  try {
    // 2. Validate
    const body = await request.json();
    const validation = requestSchema.safeParse(body);
    if (!validation.success) {
      return badRequestResponse('Invalid input', validation.error.flatten());
    }

    // 3. Business Logic
    const { error } = await supabaseAdmin
      .from('table')
      .insert({ user_id: auth.userId, ...validation.data });

    if (error) {
      return serverErrorResponse();
    }

    // 4. Audit (if sensitive)
    await logAudit({
      user_id: auth.userId!,
      action: 'action_name',
      target_table: 'table',
    });

    // 5. Response
    return successResponse({ success: true });
  } catch {
    return serverErrorResponse();
  }
}
```

---

## VALIDATION CHECKLIST

After completing all phases, verify:

### Security
- [ ] No credentials written from client code
- [ ] No credential table (user_config) accessed from client
- [ ] SERVICE_ROLE_KEY not in any client bundle
- [ ] All credentials encrypted in database
- [ ] No financial settings accepted without server validation
- [ ] No cross-user data accessible from client
- [ ] No business logic in RLS policies

### Architecture
- [ ] `src/lib/supabase/admin.ts` exists and is server-only
- [ ] `src/lib/server/encryption.ts` exists
- [ ] `src/lib/server/auth.ts` exists
- [ ] All sensitive tables blocked from client
- [ ] All API routes use Zod validation
- [ ] Admin operations use centralized auth check

### Observability
- [ ] `audit_logs` table exists
- [ ] Critical actions are logged
- [ ] No silent empty responses
- [ ] All errors return structured responses

---

## EXECUTION ORDER

Execute in this exact order:

1. **Phase 0**: Foundation Setup (all steps)
2. **Phase 5**: Database Setup (RLS + audit table)
3. **Phase 1**: Credential Security
4. **Phase 2**: Financial Controls
5. **Phase 3**: Admin Hardening
6. **Phase 4**: User Data Access
7. **Phase 6**: Client Refactoring
8. **Validation**: Run full checklist

---

## ROLLBACK PLAN

If issues occur:

1. Keep old client code commented, not deleted
2. Use feature flags for gradual rollout
3. Monitor audit_logs for anomalies
4. Database changes are additive (don't drop columns)

---

*Document Version: 1.0*
*Last Updated: 2025-01-01*
*Applicable To: AiRA Trading Platform*
