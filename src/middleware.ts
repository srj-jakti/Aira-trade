import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  
    // Define public paths that don't require authentication
    const publicPaths = ["/", "/signin", "/signup", "/forgot-password", "/reset-password"];
    const isPublicPath = 
      publicPaths.includes(pathname) || 
      pathname.startsWith("/auth/") ||
      pathname.startsWith("/api/cron/") || // Allow cron jobs
      pathname.startsWith("/api/admin/system-health/") || // Allow health checks
      pathname === "/favicon.ico";

  // Redirect to dashboard if logged in and trying to access auth pages or landing page
  // IMPORTANT: Do NOT redirect from /reset-password - users need to be logged in to update password
  if (user && (
    pathname === "/signin" || 
    pathname === "/signup" || 
    pathname === "/forgot-password" || 
    pathname === "/"
  )) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Redirect to signin if not logged in and trying to access protected pages
  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/signin";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
