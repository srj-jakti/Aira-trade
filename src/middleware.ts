import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PLAN_ROUTE_ACCESS: Record<string, string[]> = {
  basic: ["/dashboard", "/strategy", "/analysis", "/scanner", "/settings"],
  pro: ["/dashboard", "/strategy", "/analysis", "/scanner", "/settings"],
  elite: ["/dashboard", "/strategy", "/analysis", "/scanner", "/settings"],
  admin: ["/dashboard", "/strategy", "/analysis", "/scanner", "/settings", "/admin"],
};

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

  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (error) {
    console.error("Supabase auth error in middleware:", error);
  }

  const pathname = request.nextUrl.pathname;

  const publicPaths = ["/", "/signin", "/signup", "/forgot-password", "/reset-password", "/pricing"];
  const legalPaths = ["/legal/terms", "/legal/privacy", "/legal/risk-disclosure"];
  const isPublicPath =
    publicPaths.includes(pathname) ||
    legalPaths.includes(pathname) ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/api/admin/system-health/") ||
    pathname.startsWith("/api/subscription") ||
    pathname === "/favicon.ico" ||
    (pathname === "/" && request.nextUrl.searchParams.has("code"));

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

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/signin";
    return NextResponse.redirect(url);
  }

  const protectedRoutes = ["/strategy", "/analysis", "/scanner", "/settings", "/admin"];
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

  if (user && isProtectedRoute) {
    // Explicitly exempt the super admin from all checks
    if (user.email === "sharansrj@gmail.com") {
      return supabaseResponse;
    }

    const { data: adminUser } = await supabase
      .from("admin_users")
      .select("id")
      .eq("email", user.email)
      .single();

    if (adminUser) {
      return supabaseResponse;
    }

    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("plan_id, status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (!subscription) {
      const url = request.nextUrl.clone();
      url.pathname = "/pricing";
      url.searchParams.set("reason", "subscription_required");
      return NextResponse.redirect(url);
    }

    const planId = subscription.plan_id?.toLowerCase() || "basic";
    const allowedRoutes = PLAN_ROUTE_ACCESS[planId] || PLAN_ROUTE_ACCESS.basic;

    if (pathname.startsWith("/admin") && planId !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    const hasAccess = allowedRoutes.some(route => pathname.startsWith(route));
    if (!hasAccess) {
      const url = request.nextUrl.clone();
      url.pathname = "/pricing";
      url.searchParams.set("reason", "upgrade_required");
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|service-worker.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
