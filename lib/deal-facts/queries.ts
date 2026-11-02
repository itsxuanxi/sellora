import "server-only";
import { db } from "@/lib/db";
import type { DealFactView, FactKind, FactSource, FactStatus } from "@/lib/deal-facts/kinds";
import { bestByKind } from "@/lib/deal-facts/kinds";

/**
 * Reading and writing what is known about a deal.
 *
 * Every query filters on `orgId`. Agencies share one database and a deal id
 * in a form post is a request, not a permission — `__tests__/isolation.test.ts`
 * asserts the filter is present in every call here.
 */

function toView(row: {
  id: string;
  kind: string;
  value: string;
  status: string;
  sourceKind: string;
  evidence: string | null;
  correctedFrom: string | null;
  lastVerifiedAt: Date | null;
}): DealFactView {
  let evidence: string[] = [];
  if (row.evidence) {
    try {
      const parsed = JSON.parse(row.evidence);
      if (Array.isArray(parsed)) evidence = parsed.filter((v) => typeof v === "string");
    } catch {
      // A malformed payload costs the citation, not the page.
    }
  }
  return {
    id: row.id,
    kind: row.kind as FactKind,
    value: row.value,
    status: row.status as FactStatus,
    sourceKind: row.sourceKind as FactSource,
    evidence,
    correctedFrom: row.correctedFrom,
    lastVerifiedAt: row.lastVerifiedAt,
  };
}

const FACT_SELECT = {
  id: true,
  kind: true,
  value: true,
  status: true,
  sourceKind: true,
  evidence: true,
  correctedFrom: true,
  lastVerifiedAt: true,
} as const;

/** Facts for a set of deals, rejections excluded, best-known per kind. */
export async function factsForOpportunities(
  orgId: string,
  opportunityIds: string[]
): Promise<Map<string, Partial<Record<FactKind, DealFactView>>>> {
  const out = new Map<string, Partial<Record<FactKind, DealFactView>>>();
  if (opportunityIds.length === 0) return out;

  const rows = await db.dealFact.findMany({
    where: {
      orgId,
      opportunityId: { in: opportunityIds },
      // A suggestion a person has already corrected is never re-offered.
      rejectedAt: null,
    },
    select: { ...FACT_SELECT, opportunityId: true },
  });

  const byOpportunity = new Map<string, DealFactView[]>();
  for (const row of rows) {
    const list = byOpportunity.get(row.opportunityId) ?? [];
    list.push(toView(row));
    byOpportunity.set(row.opportunityId, list);
  }
  for (const [id, list] of byOpportunity) out.set(id, bestByKind(list));
  return out;
}

/** Every fact on one deal, including rejected ones, for the detail view. */
export async function factsForOpportunity(orgId: string, opportunityId: string) {
  const rows = await db.dealFact.findMany({
    where: { orgId, opportunityId },
    orderBy: [{ kind: "asc" }, { updatedAt: "desc" }],
    select: { ...FACT_SELECT, rejectedAt: true, confirmedAt: true, updatedAt: true },
  });
  return rows.map((r) => ({
    ...toView(r),
    rejectedAt: r.rejectedAt,
    confirmedAt: r.confirmedAt,
    updatedAt: r.updatedAt,
  }));
}

/** Objections across the workspace, for the sales-memory panel. */
export async function objectionsForOrg(orgId: string) {
  const rows = await db.dealFact.findMany({
    where: { orgId, kind: "objection", rejectedAt: null },
    select: { opportunityId: true, value: true },
  });
  return rows;
}

/** Deals excluded from recovery, by opportunity. */
export async function exclusionsForOpportunities(
  orgId: string,
  opportunityIds: string[]
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (opportunityIds.length === 0) return out;
  const rows = await db.recoveryExclusion.findMany({
    where: { orgId, opportunityId: { in: opportunityIds } },
    select: { opportunityId: true, reason: true },
  });
  for (const row of rows) {
    out.set(row.opportunityId, [...(out.get(row.opportunityId) ?? []), row.reason]);
  }
  return out;
}
