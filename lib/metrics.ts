import "server-only";
import { format, startOfDay, subDays } from "date-fns";
import { db } from "@/lib/db";
import { PIPELINE_STAGES, type PipelineStage } from "@/lib/constants";

export interface OutreachPoint {
  date: string; // "Jun 12"
  sent: number;
  opened: number;
  replied: number;
}

export interface DashboardData {
  totalProspects: number;
  prospectsDelta: number; // new in last 30d
  emailsSent: number;
  emailsDelta: number;
  replyRate: number; // percent
  openRate: number;
  meetingsBooked: number;
  aiScore: number;
  outreachSeries: OutreachPoint[];
  stageDistribution: { stage: PipelineStage; label: string; count: number }[];
}

export async function getDashboardData(orgId: string): Promise<DashboardData> {
  const now = new Date();
  const since30 = startOfDay(subDays(now, 29));
  const since60 = startOfDay(subDays(now, 59));

  const [
    totalProspects,
    prospectsDelta,
    sentEmails,
    emailsPrev,
    followUpsSent,
    stageGroups,
  ] = await Promise.all([
    db.prospect.count({ where: { orgId } }),
    db.prospect.count({ where: { orgId, createdAt: { gte: since30 } } }),
    db.email.findMany({
      where: { orgId, sentAt: { not: null } },
      select: { sentAt: true, openedAt: true, repliedAt: true, status: true },
    }),
    db.email.count({
      where: { orgId, sentAt: { gte: since60, lt: since30 } },
    }),
    db.followUp.count({
      where: { email: { orgId }, status: "SENT" },
    }),
    db.prospect.groupBy({
      by: ["stage"],
      where: { orgId },
      _count: { _all: true },
    }),
  ]);

  const totalSent = sentEmails.length + followUpsSent;
  const opened = sentEmails.filter((e) => e.openedAt).length;
  const replied = sentEmails.filter((e) => e.repliedAt).length;
  const openRate = sentEmails.length ? (opened / sentEmails.length) * 100 : 0;
  const replyRate = sentEmails.length ? (replied / sentEmails.length) * 100 : 0;

  const stageCounts = new Map(
    stageGroups.map((g) => [g.stage, g._count._all])
  );
  const meetingsBooked =
    (stageCounts.get("MEETING") ?? 0) +
    (stageCounts.get("PROPOSAL") ?? 0) +
    (stageCounts.get("WON") ?? 0);

  // Composite health score: reply quality dominates, opens and follow-up
  // discipline contribute, clamped to a readable 0–100.
  const followUpCoverage = sentEmails.length
    ? Math.min(1, followUpsSent / sentEmails.length)
    : 0;
  const aiScore = Math.min(
    100,
    Math.round(38 + replyRate * 1.6 + openRate * 0.35 + followUpCoverage * 18)
  );

  // Daily buckets for the last 30 days
  const buckets = new Map<string, OutreachPoint>();
  for (let i = 29; i >= 0; i--) {
    const day = subDays(now, i);
    const key = format(day, "MMM d");
    buckets.set(key, { date: key, sent: 0, opened: 0, replied: 0 });
  }
  const bump = (d: Date | null, field: "sent" | "opened" | "replied") => {
    if (!d || d < since30) return;
    const key = format(d, "MMM d");
    const point = buckets.get(key);
    if (point) point[field] += 1;
  };
  for (const e of sentEmails) {
    bump(e.sentAt, "sent");
    bump(e.openedAt, "opened");
    bump(e.repliedAt, "replied");
  }

  const emailsSent30 = sentEmails.filter(
    (e) => e.sentAt && e.sentAt >= since30
  ).length;

  return {
    totalProspects,
    prospectsDelta,
    emailsSent: totalSent,
    emailsDelta: emailsPrev
      ? Math.round(((emailsSent30 - emailsPrev) / emailsPrev) * 100)
      : emailsSent30 > 0
        ? 100
        : 0,
    replyRate: Math.round(replyRate * 10) / 10,
    openRate: Math.round(openRate * 10) / 10,
    meetingsBooked,
    aiScore: sentEmails.length ? aiScore : 0,
    outreachSeries: [...buckets.values()],
    stageDistribution: PIPELINE_STAGES.map((stage) => ({
      stage,
      label: stage,
      count: stageCounts.get(stage) ?? 0,
    })),
  };
}
