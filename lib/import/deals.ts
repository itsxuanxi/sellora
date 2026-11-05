import { OPPORTUNITY_STAGES, type OpportunityStage } from "@/lib/revenue/config";
import { csvLines, mapHeaders, splitCsvLine, type RowError } from "@/lib/import/csv";

/**
 * Importing opportunities from a spreadsheet.
 *
 * This is how a pilot customer gets their pipeline in on day one, before any
 * CRM is connected, so it has to survive the file they actually have rather
 * than the file we would like. That means aliases for every column, a stage
 * vocabulary wider than our own, amounts with currency symbols and commas,
 * and dates in the formats a spreadsheet produces.
 *
 * Two rules it does not bend on:
 *
 *  - **A row either parses or is reported.** Nothing is silently dropped and
 *    nothing is guessed into place. A row with an unreadable amount is an
 *    error on that line, not a deal worth zero.
 *  - **Re-importing the same file changes nothing.** `external_id` is the
 *    identity; the same id updates the deal it already created instead of
 *    making a second one. Without that, the natural response to a failed
 *    import — fix two rows and upload again — doubles the pipeline.
 *
 * Pure: no Prisma, no clock of its own. `lib/import/apply.ts` does the writing.
 */

/** The template columns, in the order the downloadable file presents them. */
export const DEAL_COLUMNS = [
  "external_id",
  "company",
  "contact_name",
  "contact_email",
  "stage",
  "amount",
  "currency",
  "last_contacted_at",
  "next_step_at",
] as const;

export type DealColumn = (typeof DEAL_COLUMNS)[number];

/** What each column may be called in a real export. */
export const DEAL_ALIASES: Record<DealColumn, readonly string[]> = {
  external_id: ["external_id", "id", "deal_id", "record_id", "opportunity_id"],
  company: ["company", "company_name", "account", "account_name", "client", "organisation", "organization"],
  contact_name: ["contact_name", "contact", "primary_contact", "name"],
  contact_email: ["contact_email", "email", "primary_email"],
  stage: ["stage", "deal_stage", "dealstage", "status", "pipeline_stage"],
  amount: ["amount", "value", "deal_value", "proposal_value", "deal_amount"],
  currency: ["currency", "currency_code"],
  last_contacted_at: ["last_contacted_at", "last_contacted", "last_activity", "last_activity_date", "last_contact"],
  next_step_at: ["next_step_at", "next_step", "next_step_date", "follow_up_date", "next_action_date"],
} as const;

/** Columns without which a row cannot become a deal. */
export const REQUIRED_COLUMNS: DealColumn[] = ["external_id", "company", "stage"];

/**
 * Stage words customers actually use, mapped to ours.
 *
 * Deliberately generous. An agency's board says "Proposal Sent" or "Pitched";
 * refusing those teaches them to edit the file to suit us, which is work we
 * have moved onto the customer for no benefit. Anything unrecognised is an
 * error on the row rather than a silent default — filing a deal in the wrong
 * stage changes what Selryn recommends about it.
 */
const STAGE_SYNONYMS: Record<string, OpportunityStage> = {
  new: "NEW",
  lead: "NEW",
  newlead: "NEW",
  enquiry: "NEW",
  inquiry: "NEW",
  qualifying: "QUALIFYING",
  qualified: "QUALIFYING",
  discovery: "QUALIFYING",
  contacted: "QUALIFYING",
  meeting: "MEETING",
  meetingbooked: "MEETING",
  call: "MEETING",
  demo: "MEETING",
  proposal: "PROPOSAL",
  proposalsent: "PROPOSAL",
  pitched: "PROPOSAL",
  quote: "PROPOSAL",
  quoted: "PROPOSAL",
  negotiation: "NEGOTIATION",
  negotiating: "NEGOTIATION",
  contract: "NEGOTIATION",
  won: "WON",
  closedwon: "WON",
  signed: "WON",
  lost: "LOST",
  closedlost: "LOST",
  declined: "LOST",
};

export function normalizeStage(raw: string): OpportunityStage | null {
  const key = raw.trim().toLowerCase().replace(/[\s_\-]+/g, "");
  if (!key) return null;
  if ((OPPORTUNITY_STAGES as readonly string[]).includes(key.toUpperCase())) {
    return key.toUpperCase() as OpportunityStage;
  }
  return STAGE_SYNONYMS[key] ?? null;
}

/**
 * Money, as a spreadsheet writes it.
 *
 * Accepts "£12,500", "12500.00", "12 500". Rejects anything else rather than
 * coercing — a deal silently worth 0 because a cell said "TBC" is worse than
 * a row the importer refused, because nobody ever notices the zero.
 */
export function parseAmount(raw: string): { ok: true; value: number | null } | { ok: false } {
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: true, value: null };

  const cleaned = trimmed.replace(/[£$€¥]/g, "").replace(/[,\s]/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return { ok: false };

  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return { ok: false };
  return { ok: true, value: Math.round(value) };
}

/**
 * Dates, in the formats a spreadsheet produces.
 *
 * ISO and `YYYY/MM/DD` are unambiguous and accepted. A bare `03/04/2026` is
 * not — it is March in one country and April in another, and guessing puts a
 * follow-up date a month wrong without telling anyone. That row gets an
 * error asking for ISO.
 */
export function parseDate(raw: string): { ok: true; value: Date | null } | { ok: false } {
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: true, value: null };

  if (!/^\d{4}[-/]\d{1,2}([-/]\d{1,2})?([T ].*)?$/.test(trimmed)) return { ok: false };

  const parsed = new Date(trimmed.replace(/\//g, "-"));
  if (Number.isNaN(parsed.getTime())) return { ok: false };
  return { ok: true, value: parsed };
}

const CURRENCY = /^[A-Za-z]{3}$/;

export interface ParsedDeal {
  /** Line number in the uploaded file, for reporting. */
  row: number;
  externalId: string;
  company: string;
  contactName: string | null;
  contactEmail: string | null;
  stage: OpportunityStage;
  amount: number | null;
  currency: string;
  lastContactedAt: Date | null;
  nextStepAt: Date | null;
}

export interface DealParseResult {
  deals: ParsedDeal[];
  errors: RowError[];
  /** Template columns the file did not provide. */
  missingColumns: DealColumn[];
  /** Columns present in the file that the importer ignores. */
  ignoredColumns: string[];
}

export function parseDealsCsv(text: string, defaultCurrency = "USD"): DealParseResult {
  const lines = csvLines(text);
  const result: DealParseResult = { deals: [], errors: [], missingColumns: [], ignoredColumns: [] };

  if (lines.length === 0) {
    result.errors.push({ row: 1, message: "The file is empty." });
    return result;
  }

  const header = splitCsvLine(lines[0]);
  const index = mapHeaders(header, DEAL_ALIASES);

  result.missingColumns = DEAL_COLUMNS.filter((c) => index[c] === undefined);
  const claimed = new Set(Object.values(index));
  result.ignoredColumns = header.filter((_, i) => !claimed.has(i)).filter(Boolean);

  const missingRequired = REQUIRED_COLUMNS.filter((c) => index[c] === undefined);
  if (missingRequired.length > 0) {
    result.errors.push({
      row: 1,
      message: `The file needs a column for ${missingRequired.join(", ")}. Download the template to see the expected headers.`,
    });
    return result;
  }

  const seen = new Map<string, number>();

  for (let i = 1; i < lines.length; i++) {
    const rowNumber = i + 1;
    const cells = splitCsvLine(lines[i]);
    const at = (column: DealColumn) => {
      const position = index[column];
      return position === undefined ? "" : (cells[position] ?? "");
    };

    const externalId = at("external_id");
    const company = at("company");

    if (!externalId) {
      result.errors.push({ row: rowNumber, column: "external_id", message: "Missing an id. Every row needs one so a re-import updates the deal instead of creating a second." });
      continue;
    }
    if (!company) {
      result.errors.push({ row: rowNumber, column: "company", message: "Missing the company name." });
      continue;
    }

    // A file that lists the same id twice would otherwise have its last row
    // silently win, which looks like the importer lost a deal.
    const firstSeen = seen.get(externalId);
    if (firstSeen !== undefined) {
      result.errors.push({ row: rowNumber, column: "external_id", message: `Duplicate id "${externalId}", already used on row ${firstSeen}.` });
      continue;
    }

    const stage = normalizeStage(at("stage"));
    if (!stage) {
      result.errors.push({ row: rowNumber, column: "stage", message: `Unrecognised stage "${at("stage")}". Use one of: new, qualifying, meeting, proposal, negotiation, won, lost.` });
      continue;
    }

    const amount = parseAmount(at("amount"));
    if (!amount.ok) {
      result.errors.push({ row: rowNumber, column: "amount", message: `Could not read the amount "${at("amount")}". Use a number such as 12500.` });
      continue;
    }

    const lastContacted = parseDate(at("last_contacted_at"));
    if (!lastContacted.ok) {
      result.errors.push({ row: rowNumber, column: "last_contacted_at", message: `Could not read the date "${at("last_contacted_at")}". Use YYYY-MM-DD.` });
      continue;
    }

    const nextStep = parseDate(at("next_step_at"));
    if (!nextStep.ok) {
      result.errors.push({ row: rowNumber, column: "next_step_at", message: `Could not read the date "${at("next_step_at")}". Use YYYY-MM-DD.` });
      continue;
    }

    const rawCurrency = at("currency").trim().toUpperCase();
    if (rawCurrency && !CURRENCY.test(rawCurrency)) {
      result.errors.push({ row: rowNumber, column: "currency", message: `"${rawCurrency}" is not a three-letter currency code such as USD or GBP.` });
      continue;
    }

    const email = at("contact_email").trim().toLowerCase();
    if (email && !email.includes("@")) {
      result.errors.push({ row: rowNumber, column: "contact_email", message: `"${email}" is not an email address.` });
      continue;
    }

    seen.set(externalId, rowNumber);
    result.deals.push({
      row: rowNumber,
      externalId,
      company,
      contactName: at("contact_name") || null,
      contactEmail: email || null,
      stage,
      amount: amount.value,
      currency: rawCurrency || defaultCurrency,
      lastContactedAt: lastContacted.value,
      nextStepAt: nextStep.value,
    });
  }

  return result;
}

/** The file offered on the import screen, so the first attempt can succeed. */
export function dealTemplateCsv(): string {
  return [
    DEAL_COLUMNS.join(","),
    "DEAL-001,Northwind Retail,Priya Shah,priya@northwind.example,proposal,12500,GBP,2026-10-28,2026-11-10",
    "DEAL-002,Acme Dental,Tom Reed,tom@acmedental.example,negotiation,8000,GBP,2026-11-01,",
    "DEAL-003,Bright Studio,,,qualifying,,GBP,2026-10-14,",
  ].join("\n");
}
