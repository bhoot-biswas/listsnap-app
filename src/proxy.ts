import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Two cheap checks before a request reaches the app, neither touching the database:
 *
 * - An app page with no session cookie goes to /sign-in. Optimistic only;
 *   requireWorkspace() in the DAL does the real check on every page.
 * - A call that changes something under /api must come from ListSnap's own pages. The
 *   session cookie is SameSite=Lax, which already keeps other sites out, but a page on a
 *   sibling subdomain (the demo store) counts as the same site, and a store draft or a
 *   public post is too much to leave on that alone.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api/")) {
    return crossOrigin(request) ? refused() : NextResponse.next();
  }
  // /media/:id files answer for themselves (workspace-checked, 404 otherwise)
  if (pathname.startsWith("/media/")) return NextResponse.next();
  if (!getSessionCookie(request, { cookiePrefix: "listsnap" })) {
    const url = new URL("/sign-in", request.url);
    // the query too: a Review link names its listing with ?l=
    url.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

// Better Auth checks origins itself; Shopify's webhooks come from Shopify, HMAC-signed
const OWN_CHECKS = ["/api/auth/", "/api/shopify/webhooks"];

/**
 * A browser request that changes something from another origin. Browsers say where a
 * request comes from in Sec-Fetch-Site; ones too old to send it still send Origin on a
 * POST. A request with neither isn't from a browser page, so no visitor's cookie rides on it.
 */
export function crossOrigin(request: Request): boolean {
  if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") return false;
  const path = new URL(request.url).pathname;
  if (OWN_CHECKS.some((p) => path.startsWith(p))) return false;
  const site = request.headers.get("sec-fetch-site");
  if (site) return site !== "same-origin" && site !== "none";
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== request.headers.get("host");
  } catch {
    return true;
  }
}

const refused = () =>
  NextResponse.json(
    { error: { code: "cross_origin", message: "This request has to come from ListSnap itself." } },
    { status: 403 },
  );

export const config = {
  matcher: [
    "/api/:path*",
    "/dashboard/:path*",
    "/assistant/:path*",
    "/onboarding/:path*",
    "/snap/:path*",
    "/job/:path*",
    "/listings/:path*",
    "/bulk/:path*",
    "/media/:path*",
    "/connections/:path*",
    "/usage/:path*",
    "/settings/:path*",
    "/profile/:path*",
    "/help/:path*",
  ],
};
