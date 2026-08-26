import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

const clerkEnabled = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY
);

// Must match lib/local-auth.ts SESSION_COOKIE (middleware can't import
// server-only modules).
const SESSION_COOKIE = "sellora_session";

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
 * With Clerk keys, Clerk owns route protection. Without them, the built-in
 * auth applies a fast cookie-presence check here; full session validation
 * (expiry, revocation) happens server-side in requireSession.
 */
export default clerkEnabled
  ? clerkMiddleware(async (auth, req) => {
      if (isProtectedRoute(req)) await auth.protect();
    })
  : (req: NextRequest) => {
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
