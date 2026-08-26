import type { RawSignalInput } from "@/lib/intent/signals";

/**
 * Every external data source — real or not-yet-real — implements this
 * shape. The MVP ships exactly two: a CSV/manual provider (real data, user
 * supplied) and a clearly-labeled mock provider (demo data, for evaluating
 * the product before a real feed is connected). Adding a real job-board or
 * funding-data API later means writing one more file that satisfies this
 * interface — nothing else in the app changes.
 */
export interface DetectedSignal {
  companyName: string;
  domain?: string | null;
  industry?: string | null;
  region?: string | null;
  companySize?: string | null;
  signal: RawSignalInput;
}

export interface SignalProvider {
  key: string; // matches SignalSource.key
  name: string;
  kind: "csv" | "manual" | "mock" | "api";
}
