import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

const clerkEnabled = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY
);

// Must match lib/local-auth.ts SESSION_COOKIE (middleware can't import
// server-only modules).
const SESSION_COOKIE = "selryn_session";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/prospects(.*)",
  "/campaigns(.*)",
  "/pipeline(.*)",
  "/insights(.*)",
  "/settings(.*)",
  "/onboarding(.*)",
  "/accounts(.*)",
  "/icp(.*)",
  "/agent(.*)",
  "/intent(.*)",
  "/opportunities(.*)",
  "/recover(.*)",
  "/signals(.*)",
  "/analytics(.*)",
]);

/**
 * The one hostname the product is served under, taken from the same variable
 * that already tells the rest of the app what its public address is. Changing
 * the canonical host is therefore an environment change and a redeploy, not a
 * code edit.
 */
const CANONICAL_HOST = (() => {
  const raw = process.env.NEXT_PUBLIC_APP_URL;
  if (!raw) return null;
  try {
    return new URL(raw).host;
  } catch {
    return null;
  }
})();

/**
 * Hosts that still resolve but are no longer the address.
 *
 * An explicit list, rather than "anything that is not canonical": every
 * preview deployment gets its own *.vercel.app hostname, and bouncing those
 * to production would make it impossible to test a branch before shipping it.
 */
const LEGACY_HOSTS = new Set([
  "sellora.ai",
  "www.sellora.ai",
  "sellora-mu.vercel.app",
]);

/**
 * Moves a request on a legacy host to the canonical one, preserving the path
 * and query so existing links keep landing where they meant to.
 *
 * `/api` is deliberately exempt. Stripe and Resend do not follow redirects on
 * webhook delivery — they record a 3xx as a failed attempt — so redirecting
 * those paths would silently break billing against whichever endpoint URL is
 * registered in their dashboards. OAuth callbacks are under /api too, and a
 * provider matches the redirect URI it was given exactly.
 *
 * 308 rather than 301: both are permanent, but 308 preserves the method, so a
 * POST that somehow reached a page route is not quietly turned into a GET.
 */
function canonicalRedirect(req: NextRequest): NextResponse | null {
  if (!CANONICAL_HOST) return null;

  const host = req.headers.get("host");
  if (!host || host === CANONICAL_HOST) return null;
  if (!LEGACY_HOSTS.has(host)) return null;
  if (req.nextUrl.pathname.startsWith("/api/")) return null;

  const url = req.nextUrl.clone();
  url.protocol = "https:";
  url.host = CANONICAL_HOST;
  url.port = "";
  return NextResponse.redirect(url, 308);
}

/**
 * With Clerk keys, Clerk owns route protection. Without them, the built-in
 * auth applies a fast cookie-presence check here; full session validation
 * (expiry, revocation) happens server-side in requireSession.
 *
 * The host redirect runs before either, so a visitor on an old hostname is
 * moved to the canonical one before anything decides whether they are allowed
 * in — otherwise a signed-out visitor to a protected path would be sent to
 * /sign-in on the host they were leaving.
 */
export default clerkEnabled
  ? clerkMiddleware(async (auth, req) => {
      const moved = canonicalRedirect(req);
      if (moved) return moved;
      if (isProtectedRoute(req)) await auth.protect();
    })
  : (req: NextRequest) => {
      const moved = canonicalRedirect(req);
      if (moved) return moved;
      if (isProtectedRoute(req) && !req.cookies.get(SESSION_COOKIE)) {
        return NextResponse.redirect(new URL("/sign-in", req.url));
      }
      return NextResponse.next();
    };

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
