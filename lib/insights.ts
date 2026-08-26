import "server-only";
import { differenceInDays, subDays } from "date-fns";
import { db } from "@/lib/db";
import type { InsightsContext } from "@/lib/ai";

/** Assembles the real outreach metrics the AI reasons over. */
export async function buildInsightsContext(
  orgId: string
): Promise<InsightsContext> {
  const now = new Date();
  const weekAgo = subDays(now, 7);
  const twoWeeksAgo = subDays(now, 14);

  const [prospects, emails, campaigns] = await Promise.all([
    db.prospect.findMany({ where: { orgId } }),
    db.email.findMany({
      where: { orgId, sentAt: { not: null } },
      include: {
        prospect: { select: { name: true, company: true } },
        followUps: { select: { status: true } },
      },
    }),
    db.campaign.findMany({
      where: { orgId },
      include: { emails: { select: { status: true } } },
    }),
  ]);

  const sentThisWeek = emails.filter((e) => e.sentAt! >= weekAgo);
  const sentLastWeek = emails.filter(
    (e) => e.sentAt! >= twoWeeksAgo && e.sentAt! < weekAgo
  );
  const rate = (list: typeof emails) =>
    list.length
      ? (list.filter((e) => e.repliedAt).length / list.length) * 100
      : 0;

  const stageCounts: Record<string, number> = {};
  for (const p of prospects) {
    stageCounts[p.stage] = (stageCounts[p.stage] ?? 0) + 1;
  }

  const hotProspects = emails
    .filter((e) => e.openedAt && !e.repliedAt)
    .sort((a, b) => b.openedAt!.getTime() - a.openedAt!.getTime())
    .slice(0, 5)
    .map((e) => ({
      name: e.prospect.name,
      company: e.prospect.company,
      signal: `opened your email ${differenceInDays(now, e.openedAt!) <= 2 ? "in the last 48 hours" : `${differenceInDays(now, e.openedAt!)} days ago`} without replying`,
    }));

  const staleProspects = emails
    .filter(
      (e) =>
        !e.repliedAt &&
        !e.openedAt &&
        differenceInDays(now, e.sentAt!) >= 5 &&
        !e.followUps.some((f) => f.status === "SENT")
    )
    .sort((a, b) => a.sentAt!.getTime() - b.sentAt!.getTime())
    .slice(0, 5)
    .map((e) => ({
      name: e.prospect.name,
      company: e.prospect.company,
      daysSinceContact: differenceInDays(now, e.sentAt!),
    }));

  return {
    totals: {
      prospects: prospects.length,
      emailsSent: emails.length,
      opened: emails.filter((e) => e.openedAt).length,
      replied: emails.filter((e) => e.repliedAt).length,
      meetings: (stageCounts.MEETING ?? 0) + (stageCounts.PROPOSAL ?? 0),
      won: stageCounts.WON ?? 0,
      lost: stageCounts.LOST ?? 0,
    },
    replyRateThisWeek: Math.round(rate(sentThisWeek) * 10) / 10,
    replyRateLastWeek: Math.round(rate(sentLastWeek) * 10) / 10,
    stageCounts,
    hotProspects,
    staleProspects,
    campaigns: campaigns.map((c) => ({
      name: c.name,
      sent: c.emails.filter((e) => e.status !== "DRAFT").length,
      opened: c.emails.filter((e) => ["OPENED", "REPLIED"].includes(e.status))
        .length,
      replied: c.emails.filter((e) => e.status === "REPLIED").length,
    })),
  };
}
