/** Small retry-with-backoff helper for flaky external calls (OpenAI, Resend,
 * future job-board/funding APIs). Not a queue — just enough to absorb
 * transient network/5xx errors without failing a user-facing action. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { attempts?: number; baseDelayMs?: number; label?: string } = {}
): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 300;
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i === attempts - 1) break;
      const delay = baseDelayMs * Math.pow(2, i);
      console.warn(`[intent] ${opts.label ?? "call"} failed (attempt ${i + 1}/${attempts}), retrying in ${delay}ms:`, err);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
