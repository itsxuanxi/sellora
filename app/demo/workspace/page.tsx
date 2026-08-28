"use client";

import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { PipelineSummary, PriorityTable } from "@/components/revenue/priority-table";
import type { PriorityRow } from "@/lib/revenue/priority-row";
import { useCompleteStep, useDemo } from "@/components/demo/demo-store";
import { DemoDataBadge } from "@/components/demo/demo-chrome";
import { DEMO_ROUTES } from "@/lib/demo/steps";
import { DEMO_NOTE, RANKED_PIPELINE, formatUsd } from "@/lib/demo/fixture";

/**
 * Step 1's surface — and the screen a customer gets after signing in.
 *
 * Same `PriorityTable`, same header, same summary strip as `/dashboard`; only
 * the data source differs. Cloudmint sits first because expected revenue puts
 * it there — Northstar is the larger deal at $68,000 and ranks below it. That
 * ordering is the point of the screen, so the table shows the arithmetic in a
 * column rather than asserting a rank the visitor has to take on trust.
 */
export default function DemoWorkspacePage() {
  const { state } = useDemo();
  const completeStep = useCompleteStep();
  const router = useRouter();

  function openOpportunity(id: string) {
    if (id !== "cloudmint") return;
    completeStep("opportunityOpened");
    router.push(DEMO_ROUTES.opportunity);
  }

  const rows: PriorityRow[] = RANKED_PIPELINE.map((r) => {
    const isFocus = r.id === "cloudmint";
    // The focus row carries the live values so the number the visitor sees
    // here can never disagree with the detail page.
    return {
      id: r.id,
      company: r.company,
      stage: isFocus ? state.stage : r.stage,
      note: r.note,
      dealValue: r.dealValue,
      winProbability: isFocus ? state.winProbability : r.winProbability,
      expected: isFocus ? state.expectedRevenue : r.expected,
      lastActivity: isFocus && state.opportunityUpdated ? "just now" : r.lastActivity,
      needsAttention: isFocus && !state.opportunityUpdated,
      currency: "USD",
      demoTarget: isFocus ? "pipeline-cloudmint" : undefined,
    };
  });

  const openPipeline = rows.reduce((s, r) => s + r.dealValue, 0);
  const atRisk = state.opportunityUpdated ? 0 : state.expectedRevenue;

  return (
    <>
      <PageHeader
        title="Today's priorities"
        description="Ranked by expected revenue — deal value multiplied by win probability — not by deal size or recency."
      >
        <DemoDataBadge />
      </PageHeader>

      <PriorityTable
        rows={rows}
        onSelect={openOpportunity}
        interactiveIds={["cloudmint"]}
      />

      <PipelineSummary
        items={[
          {
            label: "Revenue at risk",
            value: formatUsd(atRisk),
            tone: atRisk > 0 ? "critical" : "neutral",
          },
          { label: "Open pipeline", value: formatUsd(openPipeline) },
          { label: "Open opportunities", value: String(rows.length) },
        ]}
      />

      <p className="mt-4 text-[12px] text-muted-foreground">
        {DEMO_NOTE}. Only Cloudmint is interactive in this demo.
      </p>
    </>
  );
}
