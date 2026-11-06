import { PrismaClient } from "@prisma/client";
import { parseDealsCsv } from "@/lib/import/deals";
import { applyImportedDeals } from "@/lib/import/apply";
import { getFollowUps } from "@/lib/followup/queries";
import { summarizeRisks } from "@/lib/risk/map";
import { RISK_BASIS } from "@/lib/risk/kinds";
import { syncRecommendations } from "@/lib/revenue/recommendations";
import { rescoreAllOpportunities } from "@/lib/revenue/opportunities";
import { loadEnrichedOpportunities } from "@/lib/revenue/queries";
import { findContradiction } from "@/lib/revenue/contradiction";
import { getImpactSummary } from "@/lib/revenue/queries";

const db = new PrismaClient();
const MARK = `journey-${Date.now()}`;
let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}
const d = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

async function main() {
  const org = await db.organization.create({
    data: { name: MARK, settings: { create: {} } },
    select: { id: true },
  });
  const orgId = org.id;

  // ── 1. IMPORT ──────────────────────────────────────────────────────────
  // Deliberately messy: a missing amount, a missing next step, a duplicate
  // row, two contacts at one company, and a stale deal.
  const csv = [
    "id,company,stage,amount,currency,last_contacted,next_step,contact,email",
    `D-1,Northwind Freight,Proposal,42000,USD,${d(12)},,Dana Reeve,dana@northwind.test`,
    // Same id twice: must be reported, not silently last-one-wins.
    `D-1,Northwind Freight,Proposal,42000,USD,${d(12)},,Dana Reeve,dana@northwind.test`,
    // No amount — must stay null, never 0.
    `D-2,Calderon Media,Negotiation,,USD,${d(4)},${d(-3)},Luis Calderon,luis@calderon.test`,
    `D-3,Pentland Labs,Meeting,18000,USD,${d(9)},,Ana Pentland,ana@pentland.test`,
    // 70 days stale.
    `D-4,Orrery Group,Proposal,91000,USD,${d(70)},,Tom Orrery,tom@orrery.test`,
    `D-5,Vessel Co,Qualifying,5000,USD,${d(2)},,Kit Vessel,kit@vessel.test`,
    // Unreadable amount — refused rather than coerced to 0.
    `D-6,Haldane Partners,Proposal,TBC,USD,${d(8)},,Jo Haldane,jo@haldane.test`,
  ].join("\n");

  const parsed = parseDealsCsv(csv);
  check("the file parses", parsed.deals.length === 5,
    `${parsed.deals.length} deals, ${parsed.errors.length} errors`);
  check("a duplicate id is reported, not silently merged",
    parsed.errors.some((e) => /Duplicate id/.test(e.message)),
    parsed.errors.map((e) => e.message.slice(0, 40)).join(" | "));
  check("an unreadable amount is refused, not coerced to zero",
    parsed.errors.some((e) => e.column === "amount"));

  const first = await applyImportedDeals(orgId, parsed.deals);
  check("the good rows are written", first.created === 5, `created ${first.created}`);

  // Re-import the identical file: nothing may change.
  const second = await applyImportedDeals(orgId, parseDealsCsv(csv).deals);
  check("re-importing an unchanged file writes nothing",
    second.created === 0 && second.updated === 0,
    `created ${second.created}, updated ${second.updated}`);

  // A second contact at one of the companies.
  const nw = await db.account.findFirstOrThrow({ where: { orgId, name: "Northwind Freight" } });
  await db.prospect.create({
    data: { orgId, accountId: nw.id, name: "Ruth Okafor", email: "ruth@northwind.test", company: "Northwind Freight" },
  });

  await rescoreAllOpportunities(orgId);

  // ── 2. DETECT ──────────────────────────────────────────────────────────
  const items = await getFollowUps(orgId);
  check("risks are detected on the imported deals", items.length > 0, `${items.length} items`);

  const risks = summarizeRisks(items);
  const counted = risks.reduce((s, r) => s + r.count, 0);
  check("the summary counts each deal once",
    counted === items.length, `band ${counted} vs list ${items.length}`);
  check("every item carries a basis",
    items.every((i) => i.basis === RISK_BASIS[i.risk]));
  console.log("     risks: " + risks.map((r) => `${r.label}=${r.count}(${r.basis})`).join(", "));

  const stale = items.find((i) => i.accountName === "Orrery Group");
  check("the 70-day-old deal discloses its staleness",
    Boolean(stale?.staleness), stale?.staleness ?? "no staleness set");
  const fresh = items.find((i) => i.accountName === "Vessel Co");
  check("a deal contacted 2 days ago is not on the list",
    fresh === undefined, fresh ? "it was listed" : "correctly absent");

  // ── 3. TODAY'S PRIORITIES ──────────────────────────────────────────────
  for (const i of items.slice(0, 3)) {
    const hasAll =
      Boolean(i.accountName) && Boolean(i.blocker.because) &&
      Boolean(i.blocker.recommendedAction) && Boolean(i.callOutline.objective);
    check(`priority "${i.accountName}" carries opportunity, why, action and an outline`, hasAll);
  }
  const noAmount = items.find((i) => i.accountName === "Calderon Media");
  check("a deal with no CRM amount reports null, never 0",
    noAmount !== undefined && noAmount.amount === null,
    noAmount ? `amount=${noAmount.amount}` : "not listed");

  // ── 4. REVIEW A RECOMMENDED ACTION ─────────────────────────────────────
  console.log("     sync:", JSON.stringify(await syncRecommendations(orgId)));
  const all = await loadEnrichedOpportunities(orgId);
  const target = all.find((o) => o.account.name === "Northwind Freight")!;
  const rec = await db.recommendation.findFirst({
    where: { orgId, opportunityId: target.id, status: "OPEN" },
  });
  check("a reviewable recommendation exists", Boolean(rec), rec?.headline ?? "none");
  check("it cites evidence",
    Boolean(rec?.supportingSignals) || target.facts.evidence.length > 0,
    `${target.facts.evidence.length} records`);
  check("no invented lift figure is stored", rec?.expectedImpactValue == null,
    String(rec?.expectedImpactValue));

  // ── 5. RECORD AN ACTION AND A BUYER RESPONSE ───────────────────────────
  const action = await db.action.create({
    data: {
      orgId, opportunityId: target.id, recommendationId: rec!.id,
      contactId: target.contact?.id ?? null,
      actionType: "follow_up", channel: "email", summary: "Chased the proposal",
      executionStatus: "EXECUTED", proposedAt: new Date(Date.now() - 3600_000),
      approvedAt: new Date(), executedAt: new Date(), approvedBy: "journey",
      humanEdited: true, simulated: true,
    },
  });
  check("the action records that a human edited the draft", action.humanEdited);
  check("the action is marked simulated, so nothing left the building", action.simulated);

  await db.response.create({
    data: {
      orgId, opportunityId: target.id, actionId: action.id, recommendationId: rec!.id,
      contactId: target.contact?.id ?? null, responseType: "replied",
      sentiment: "positive", detail: "Asked about rollout timing",
      hoursToRespond: 6, observedAt: new Date(),
    },
  });

  // ── 6. THE RECOMMENDATION UPDATES ──────────────────────────────────────
  const after = (await loadEnrichedOpportunities(orgId)).find((o) => o.id === target.id)!;
  check("the reply is seen wherever it was recorded",
    after.facts.replyState === "they_replied_last", after.facts.replyState);
  check("no screen can call this 'never replied'",
    !/never replied/i.test(after.replySummary), after.replySummary);
  const c = findContradiction(
    { createdAt: rec!.createdAt, leakType: rec!.leakType, actionType: rec!.actionType, expiresAt: rec!.expiresAt },
    after.facts, new Date()
  );
  check("the recommendation withdraws itself", Boolean(c), c ? `${c.kind}: ${c.because}` : "still stands");

  console.log("     resync:", JSON.stringify(await syncRecommendations(orgId)));
  const row = await db.recommendation.findUniqueOrThrow({ where: { id: rec!.id } });
  check("withdrawn, not marked complete by nobody",
    row.status === "WITHDRAWN", `status=${row.status} completedBy=${row.completedBy ?? "null"}`);

  const stillThere = (await getFollowUps(orgId)).find((i) => i.opportunityId === target.id);
  check("the answered deal leaves Today, or no longer claims silence",
    stillThere === undefined || stillThere.risk !== "awaiting_response",
    stillThere ? `still listed as ${stillThere.risk}` : "left the list");

  // ── 7. OUTCOME HISTORY ─────────────────────────────────────────────────
  const impact = await getImpactSummary(orgId);
  check("no realized-revenue figure is manufactured",
    !("revenueRecovered" in impact) && impact.closedWonValue === 0,
    `closedWonValue=${impact.closedWonValue}`);
  check("the response is counted as an event", impact.recommendationsShown > 0,
    `shown=${impact.recommendationsShown} worked=${impact.recommendationsActedOn}`);
  const ledger = await db.action.findMany({
    where: { orgId }, include: { responses: true },
  });
  check("the ledger links action to buyer response",
    ledger.some((a) => a.responses.length > 0),
    `${ledger.length} actions, ${ledger.reduce((s, a) => s + a.responses.length, 0)} responses`);

  // ── 8. TENANT ISOLATION ────────────────────────────────────────────────
  const other = await db.organization.create({
    data: { name: `${MARK}-other`, settings: { create: {} } }, select: { id: true },
  });
  check("another workspace sees none of this",
    (await getFollowUps(other.id)).length === 0);

  await db.organization.deleteMany({ where: { name: { startsWith: MARK } } });
  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  if (failures) process.exitCode = 1;
}
main().catch((e) => { console.error("THREW:", e.message); process.exitCode = 1; })
  .finally(() => db.$disconnect());
