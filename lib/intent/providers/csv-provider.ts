import type { DetectedSignal, SignalProvider } from "@/lib/intent/providers/types";
import { SIGNAL_TYPES, type SignalType } from "@/lib/intent/config";

export const csvProvider: SignalProvider = {
  key: "csv_import",
  name: "CSV import",
  kind: "csv",
};

export interface CsvParseError {
  row: number;
  message: string;
}

export interface CsvParseResult {
  detected: DetectedSignal[];
  errors: CsvParseError[];
}

const REQUIRED_HEADERS = ["company", "signal_type", "title", "occurred_at"] as const;

/** Minimal RFC-4180-ish CSV line splitter — handles quoted fields with commas. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/**
 * Expected columns (header row required, any order):
 * company, domain, industry, region, company_size, signal_type, title,
 * description, evidence, source_url, occurred_at, confidence
 *
 * This is real, user-supplied data — never fabricated — so it's the
 * recommended provider until a live job-board/funding API is connected.
 */
export function parseSignalsCsv(text: string): CsvParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const errors: CsvParseError[] = [];
  if (lines.length === 0) return { detected: [], errors: [{ row: 0, message: "Empty file" }] };

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
  const missing = REQUIRED_HEADERS.filter((h) => !header.includes(h));
  if (missing.length > 0) {
    return {
      detected: [],
      errors: [{ row: 0, message: `Missing required column(s): ${missing.join(", ")}` }],
    };
  }
  const idx = (name: string) => header.indexOf(name);

  const detected: DetectedSignal[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const get = (name: string) => cells[idx(name)]?.trim() || undefined;

    const company = get("company");
    const signalType = get("signal_type");
    const title = get("title");
    const occurredAtRaw = get("occurred_at");

    if (!company || !signalType || !title || !occurredAtRaw) {
      errors.push({ row: i + 1, message: "Missing company, signal_type, title, or occurred_at" });
      continue;
    }
    if (!SIGNAL_TYPES.includes(signalType as SignalType)) {
      errors.push({
        row: i + 1,
        message: `Unknown signal_type "${signalType}" (expected one of: ${SIGNAL_TYPES.join(", ")})`,
      });
      continue;
    }
    const occurredAt = new Date(occurredAtRaw);
    if (Number.isNaN(occurredAt.getTime())) {
      errors.push({ row: i + 1, message: `Unparseable occurred_at "${occurredAtRaw}" (use YYYY-MM-DD)` });
      continue;
    }
    const confidence = get("confidence");

    detected.push({
      companyName: company,
      domain: get("domain") ?? null,
      industry: get("industry") ?? null,
      region: get("region") ?? null,
      companySize: get("company_size") ?? null,
      signal: {
        signalType: signalType as SignalType,
        title,
        description: get("description") ?? null,
        evidence: get("evidence") ?? null,
        sourceUrl: get("source_url") ?? null,
        sourceKey: csvProvider.key,
        occurredAt,
        confidence:
          confidence === "low" || confidence === "medium" || confidence === "high"
            ? confidence
            : "medium",
      },
    });
  }

  return { detected, errors };
}
