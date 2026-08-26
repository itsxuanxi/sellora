/**
 * Money formatting and the one formula the whole product ranks by.
 *
 * All amounts in Sellora are whole currency units (dollars, not cents) —
 * see the MONEY UNITS note in prisma/schema.prisma.
 */

/** §8: Expected Revenue = Deal Value × Estimated Conversion Probability. */
export function expectedRevenue(dealValue: number, winProbability: number): number {
  return Math.round((dealValue * clampProbability(winProbability)) / 100);
}

export function clampProbability(p: number): number {
  return Math.max(0, Math.min(100, Math.round(p)));
}

/**
 * Full precision, for tables and detail pages where the exact number matters.
 * e.g. formatMoney(84200) → "$84,200"
 */
export function formatMoney(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Abbreviated, for headline stats and dense cards where width is scarce.
 * e.g. formatMoneyCompact(84200) → "$84.2K", formatMoneyCompact(1860000) → "$1.86M"
 */
export function formatMoneyCompact(amount: number, currency = "USD"): string {
  const abs = Math.abs(amount);
  if (abs < 1000) return formatMoney(amount, currency);

  const symbol = currencySymbol(currency);
  const sign = amount < 0 ? "-" : "";

  if (abs < 1_000_000) {
    const k = abs / 1000;
    // 84.2K below 100K, 842K above — keeps every value to 3-4 characters
    return `${sign}${symbol}${k < 100 ? trimZero(k.toFixed(1)) : Math.round(k)}K`;
  }
  const m = abs / 1_000_000;
  return `${sign}${symbol}${m < 100 ? trimZero(m.toFixed(m < 10 ? 2 : 1)) : Math.round(m)}M`;
}

function trimZero(s: string): string {
  return s.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

function currencySymbol(currency: string): string {
  try {
    const parts = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).formatToParts(0);
    return parts.find((p) => p.type === "currency")?.value ?? "$";
  } catch {
    return "$";
  }
}

/**
 * Estimates a deal value when the user has not entered one. Returns the
 * value AND the basis, because the UI must never present an estimate as if
 * it were a quote — every screen that shows an estimated value labels it.
 */
export function estimateDealValue(input: {
  icpMin?: number | null;
  icpMax?: number | null;
  companySize?: string | null;
}): { dealValue: number; basis: "icp_midpoint" | "account_size_heuristic" } {
  const { icpMin, icpMax, companySize } = input;

  if (icpMin != null && icpMax != null && icpMax >= icpMin) {
    const mid = Math.round((icpMin + icpMax) / 2);
    // Larger companies land in the upper half of the stated ICP range.
    const skew = SIZE_SKEW[companySize ?? ""] ?? 1;
    return {
      dealValue: Math.max(icpMin, Math.round(mid * skew)),
      basis: "icp_midpoint",
    };
  }
  if (icpMin != null) return { dealValue: icpMin, basis: "icp_midpoint" };
  if (icpMax != null) return { dealValue: icpMax, basis: "icp_midpoint" };

  return {
    dealValue: SIZE_FALLBACK[companySize ?? ""] ?? 10_000,
    basis: "account_size_heuristic",
  };
}

const SIZE_SKEW: Record<string, number> = {
  "1-10": 0.7,
  "11-50": 0.9,
  "51-200": 1.1,
  "201-1000": 1.35,
  "1000+": 1.6,
};

/** Used only when the workspace has no ICP deal range at all. */
const SIZE_FALLBACK: Record<string, number> = {
  "1-10": 4_000,
  "11-50": 8_000,
  "51-200": 15_000,
  "201-1000": 30_000,
  "1000+": 60_000,
};

export const DEAL_VALUE_BASIS_LABELS: Record<string, string> = {
  user_entered: "Entered by you",
  icp_midpoint: "Estimated from your ICP deal range",
  account_size_heuristic: "Estimated from company size",
};
