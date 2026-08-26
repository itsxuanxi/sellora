/**
 * Feature flags derived from environment configuration.
 * Server-side only reads secret keys; safe to import from server components.
 */
export const isClerkEnabled = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY
);
