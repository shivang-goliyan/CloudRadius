import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth?.user;

  // Public paths that don't require authentication
  const publicPaths = ["/login", "/register", "/forgot-password"];
  const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));
  const isApiAuth = pathname.startsWith("/api/auth");
  const isStaticAsset = pathname.startsWith("/_next") || pathname.startsWith("/favicon");

  // Allow static assets and auth API
  if (isStaticAsset || isApiAuth) {
    return NextResponse.next();
  }

  // Redirect logged-in users away from auth pages
  if (isPublicPath && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Redirect unauthenticated users to login
  if (!isPublicPath && !isLoggedIn) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Resolve tenant from subdomain for multi-tenant routing
  const hostname = req.headers.get("host") || "";
  const subdomain = extractSubdomain(hostname);

  const response = NextResponse.next();

  // Inject tenant context into headers for downstream use
  const user = req.auth?.user as Record<string, unknown> | undefined;
  if (user?.tenantId) {
    response.headers.set("x-tenant-id", user.tenantId as string);
  }
  if (subdomain) {
    response.headers.set("x-tenant-slug", subdomain);
  }

  return response;
});

function extractSubdomain(hostname: string): string | null {
  // Handle localhost and IP addresses
  if (hostname.includes("localhost") || /^\d+\.\d+\.\d+\.\d+/.test(hostname)) {
    return null;
  }

  const parts = hostname.split(".");
  // Expected format: tenant.cloudradius.com (3+ parts means subdomain exists)
  if (parts.length >= 3) {
    return parts[0];
  }

  return null;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
