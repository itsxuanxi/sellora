/** Uniform result shape for server actions consumed by client components. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function actionError(error: unknown, fallback: string): { ok: false; error: string } {
  console.error(fallback, error);
  return { ok: false, error: fallback };
}
