import "server-only";

/**
 * Next's control-flow signals, and how not to eat them.
 *
 * `redirect()` and `notFound()` work by throwing. A route handler that wraps
 * `requireSession()` in try/catch therefore catches the redirect itself, and an
 * unauthenticated visitor gets a 500 instead of the sign-in page - the error is
 * swallowed *and* the redirect never happens.
 *
 * Both are identified by a `digest` string rather than by class, because the
 * error type is internal to Next and not exported for this purpose.
 */

export function isNextControlFlow(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const digest = (err as { digest?: unknown }).digest;
  return (
    typeof digest === "string" &&
    (digest.startsWith("NEXT_REDIRECT") || digest === "NEXT_NOT_FOUND")
  );
}

/**
 * Re-throws Next's own signals, returns everything else for handling.
 *
 * Call at the top of a catch block:
 *
 *     } catch (err) {
 *       rethrowControlFlow(err);
 *       // ...real error handling
 *     }
 */
export function rethrowControlFlow(err: unknown): void {
  if (isNextControlFlow(err)) throw err;
}
