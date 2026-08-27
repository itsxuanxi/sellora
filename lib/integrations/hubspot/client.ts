import "server-only";
import { getAccessToken } from "@/lib/integrations/hubspot/oauth";

/**
 * The HubSpot REST client: retries, backoff, and rate-limit manners.
 *
 * HubSpot's limits are per-portal, not per-integration. Exceeding them does
 * not just fail Sellora's request - it degrades every other tool the customer
 * has connected to the same portal. So this client backs off on the customer's
 * behalf rather than hammering until it wins.
 *
 * What is retried, and what is not, matters more than the retry itself:
 *
 *   429 and 5xx  - transient. Retry with exponential backoff plus jitter,
 *                  honouring Retry-After when HubSpot sends one.
 *   401          - the token is dead. Retrying is pointless and burns limit;
 *                  the caller re-authenticates instead.
 *   4xx (other)  - our request is wrong. Retrying a malformed request just
 *                  sends it again. Fail fast and loudly.
 */

const API_BASE = "https://api.hubapi.com";

export class HubspotApiError extends Error {
  readonly status: number;
  readonly retryable: boolean;
  readonly body: string;

  constructor(status: number, body: string) {
    super(`HubSpot API error ${status}: ${body.slice(0, 200)}`);
    this.name = "HubspotApiError";
    this.status = status;
    this.body = body;
    this.retryable = status === 429 || status >= 500;
  }
}

export class HubspotRateLimitError extends HubspotApiError {
  readonly retryAfterMs: number;
  constructor(body: string, retryAfterMs: number) {
    super(429, body);
    this.name = "HubspotRateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 30_000;

/**
 * Exponential backoff with full jitter.
 *
 * Full jitter rather than a fixed ramp because a portal-wide 429 fails every
 * in-flight request at once. Without jitter they all retry on the same
 * schedule and re-collide indefinitely.
 */
export function backoffDelay(attempt: number, retryAfterMs?: number): number {
  if (retryAfterMs && retryAfterMs > 0) return Math.min(retryAfterMs, MAX_DELAY_MS);
  const ceiling = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
  return Math.floor(Math.random() * ceiling);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface HubspotRequestOptions {
  method?: "GET" | "POST" | "PATCH";
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  /** Overrides the default attempt budget for one call. */
  maxAttempts?: number;
  signal?: AbortSignal;
}

/**
 * One authenticated call, with the retry policy applied.
 *
 * The token is fetched per call rather than passed in, so a refresh that
 * happens mid-run is picked up on the next request instead of the whole job
 * failing with a token that expired thirty seconds ago.
 */
export async function hubspotRequest<T>(
  orgId: string,
  path: string,
  options: HubspotRequestOptions = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? MAX_ATTEMPTS;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const token = await getAccessToken(orgId);

    const url = new URL(path.startsWith("http") ? path : `${API_BASE}${path}`);
    for (const [k, v] of Object.entries(options.query ?? {})) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }

    let res: Response;
    try {
      res = await fetch(url, {
        method: options.method ?? "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: options.signal,
      });
    } catch (err) {
      // Network-level failure: no response at all, so nothing to inspect.
      // Treated as transient - a DNS blip and a dropped socket both recover.
      lastError = err;
      if (attempt === maxAttempts - 1) break;
      await sleep(backoffDelay(attempt));
      continue;
    }

    if (res.ok) {
      // 204 and friends have no body to parse.
      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    }

    const body = await res.text().catch(() => "");

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("Retry-After")) * 1000;
      lastError = new HubspotRateLimitError(body, retryAfter);
      if (attempt === maxAttempts - 1) break;
      await sleep(backoffDelay(attempt, retryAfter));
      continue;
    }

    const error = new HubspotApiError(res.status, body);
    // A dead token or a bad request will be exactly as dead on the next try.
    if (!error.retryable) throw error;

    lastError = error;
    if (attempt === maxAttempts - 1) break;
    await sleep(backoffDelay(attempt));
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`HubSpot request failed after ${maxAttempts} attempts`);
}

export interface HubspotPage<T> {
  results: T[];
  paging?: { next?: { after?: string } };
}

/**
 * Fetches one page of a CRM object list.
 *
 * Returns the cursor rather than looping internally, because the caller is a
 * resumable SyncJob: it persists `after` between pages so an interrupted
 * backfill of forty thousand deals continues instead of starting over.
 */
export async function fetchObjectPage<T>(
  orgId: string,
  objectType: string,
  opts: { after?: string; limit?: number; properties?: string[]; signal?: AbortSignal } = {}
): Promise<HubspotPage<T>> {
  return hubspotRequest<HubspotPage<T>>(orgId, `/crm/v3/objects/${objectType}`, {
    query: {
      limit: opts.limit ?? 100,
      after: opts.after,
      properties: opts.properties?.join(","),
      archived: "false",
    },
    signal: opts.signal,
  });
}

/**
 * Objects changed since a watermark, for incremental syncs.
 *
 * HubSpot's search endpoint has a much tighter rate limit than the list
 * endpoint, so this is only for the incremental path - a full backfill uses
 * `fetchObjectPage`.
 */
export async function searchModifiedSince<T>(
  orgId: string,
  objectType: string,
  since: Date,
  opts: { after?: string; limit?: number; properties?: string[] } = {}
): Promise<HubspotPage<T>> {
  return hubspotRequest<HubspotPage<T>>(orgId, `/crm/v3/objects/${objectType}/search`, {
    method: "POST",
    body: {
      filterGroups: [
        {
          filters: [
            {
              propertyName: "hs_lastmodifieddate",
              operator: "GTE",
              value: String(since.getTime()),
            },
          ],
        },
      ],
      sorts: [{ propertyName: "hs_lastmodifieddate", direction: "ASCENDING" }],
      properties: opts.properties,
      limit: opts.limit ?? 100,
      after: opts.after,
    },
  });
}

/** The deal pipelines and stages a workspace can choose between at onboarding. */
export async function fetchDealPipelines(orgId: string) {
  return hubspotRequest<{
    results: {
      id: string;
      label: string;
      stages: { id: string; label: string; displayOrder: number; metadata?: Record<string, string> }[];
    }[];
  }>(orgId, "/crm/v3/pipelines/deals");
}
