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
  
  // Normalize pathname to remove trailing slash for comparison, except for root
  const normalizedPathname = pathname !== "/" && pathname.endsWith("/") 
    ? pathname.slice(0, -1) 
    : pathname;

  const publicPaths = ["/", "/signin", "/signup", "/forgot-password", "/reset-password", "/auth/callback"];
  const isPublicPath = 
    publicPaths.includes(normalizedPathname) || 
    normalizedPathname.startsWith("/auth/") ||
    normalizedPathname === "/favicon.ico";

  // Redirect to dashboard if logged in and trying to access auth pages or landing page
  if (user && (
    normalizedPathname === "/signin" || 
    normalizedPathname === "/signup" || 
    normalizedPathname === "/forgot-password" || 
    normalizedPathname === "/"
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
