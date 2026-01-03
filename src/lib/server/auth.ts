import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";

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

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return {
        authenticated: false,
        userId: null,
        email: null,
        error: "Not authenticated",
      };
    }

    return {
      authenticated: true,
      userId: user.id,
      email: user.email || null,
    };
  } catch {
    return {
      authenticated: false,
      userId: null,
      email: null,
      error: "Auth check failed",
    };
  }
}

export async function getAdminUser(): Promise<AdminAuthResult> {
  const authResult = await getAuthenticatedUser();

  if (!authResult.authenticated || !authResult.email) {
    return { ...authResult, isAdmin: false };
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("admin_users")
      .select("id")
      .eq("email", authResult.email)
      .single();

    if (error || !data) {
      return { ...authResult, isAdmin: false };
    }

    return { ...authResult, isAdmin: true };
  } catch {
    return { ...authResult, isAdmin: false };
  }
}

export function unauthorizedResponse(message = "Unauthorized") {
  return Response.json({ error: message }, { status: 401 });
}

export function forbiddenResponse(message = "Forbidden") {
  return Response.json({ error: message }, { status: 403 });
}

export function badRequestResponse(message: string, details?: unknown) {
  return Response.json({ error: message, details }, { status: 400 });
}

export function serverErrorResponse(message = "Internal server error") {
  return Response.json({ error: message }, { status: 500 });
}

export function errorResponse(message: string, status = 500) {
  return Response.json({ error: message }, { status });
}

export function successResponse<T>(data: T, status = 200) {
  return Response.json(data, { status });
}
