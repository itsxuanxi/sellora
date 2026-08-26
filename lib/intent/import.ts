import "server-only";
import { db } from "@/lib/db";
import type { SessionContext } from "@/lib/auth";
import type { DetectedSignal } from "@/lib/intent/providers/types";
import { upsertSignal, rescoreAccount } from "@/lib/intent/signals";

export interface ImportRunSummary {
  accountsCreated: number;
  accountsMatched: number;
  signalsCreated: number;
  signalsDeduped: number;
  accountIds: string[];
}

/**
 * Shared landing point for every provider (CSV, mock, and future real
 * integrations): find-or-create the Account, upsert its signals (deduped),
 * attach it to the campaign, and recompute its score. One code path, so
 * dedup/expiry/scoring behave identically no matter where a signal came from.
 */
export async function ingestDetectedSignals(
  session: SessionContext,
  campaignId: string,
  detected: DetectedSignal[]
): Promise<ImportRunSummary> {
  const summary: ImportRunSummary = {
    accountsCreated: 0,
    accountsMatched: 0,
    signalsCreated: 0,
    signalsDeduped: 0,
    accountIds: [],
  };

  const touchedAccountIds = new Set<string>();

  for (const item of detected) {
    const name = item.companyName.trim();
    if (!name) continue;

    let account = await db.account.findUnique({
      where: { orgId_name: { orgId: session.orgId, name } },
    });
    if (account) {
      summary.accountsMatched += 1;
    } else {
      account = await db.account.create({
        data: {
          orgId: session.orgId,
          name,
          domain: item.domain ?? null,
          industry: item.industry ?? null,
          region: item.region ?? null,
          companySize: item.companySize ?? null,
          source: "imported",
          verified: true,
        },
      });
      summary.accountsCreated += 1;
    }
    touchedAccountIds.add(account.id);

    const before = await db.buyingSignal.count({ where: { accountId: account.id } });
    await upsertSignal(session.orgId, account.id, item.signal);
    const after = await db.buyingSignal.count({ where: { accountId: account.id } });
    if (after > before) summary.signalsCreated += 1;
    else summary.signalsDeduped += 1;

    await db.intentCampaignAccount.upsert({
      where: { campaignId_accountId: { campaignId, accountId: account.id } },
      update: {},
      create: { campaignId, accountId: account.id },
    });
  }

  for (const accountId of touchedAccountIds) {
    await rescoreAccount(session, accountId);
  }

  summary.accountIds = [...touchedAccountIds];
  return summary;
}
