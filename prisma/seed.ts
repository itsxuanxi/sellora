/**
 * Seeds a demo workspace so the product is fully explorable on first run.
 * Safe to re-run: it wipes and recreates only the demo organization.
 *
 * The Revenue Intelligence portion of the seed is designed, not random: it
 * builds one opportunity for each leak category in lib/revenue/config.ts, so
 * a first-time visitor sees the whole product thesis on the Overview page
 * rather than an empty dashboard. Every signal is marked as coming from the
 * `mock_demo` source, and the UI labels those "demo data" wherever they
 * appear — nothing here can be mistaken for a real detection.
 */
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { computeOpportunityScore } from "@/lib/revenue/opportunity-score";
import { SIGNAL_WEIGHTS } from "@/lib/intent/config";

/** Mirrors lib/intent/signals.ts — duplicated here rather than imported
 *  because that module is server-only and the seed runs as a plain script. */
const CONFIDENCE_SCORES: Record<string, number> = { low: 30, medium: 60, high: 90 };

function signalImportance(signalType: string): number {
  const weight = SIGNAL_WEIGHTS[signalType as keyof typeof SIGNAL_WEIGHTS];
  if (weight === undefined) return 50;
  const maxWeight = Math.max(...Object.values(SIGNAL_WEIGHTS).map(Math.abs));
  return Math.round((Math.abs(weight) / maxWeight) * 100);
}
import { expectedRevenue } from "@/lib/revenue/money";
import { SIGNAL_TTL_DAYS, type SignalType } from "@/lib/intent/config";

const db = new PrismaClient();

const DEMO_CLERK_ID = "demo_user";

const daysAgo = (n: number, hour = 10) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, Math.floor(Math.random() * 50) + 5, 0, 0);
  return d;
};

const prospects = [
  { name: "Maya Lindqvist", company: "Nordform AI", website: "https://nordform.ai", industry: "AI / Machine Learning", position: "Co-founder & CEO", email: "maya@nordform.ai", linkedin: "https://linkedin.com/in/mayalindqvist", country: "Sweden", companySize: "11-50", stage: "MEETING" },
  { name: "Daniel Okafor", company: "Shiplane", website: "https://shiplane.io", industry: "Developer Tools", position: "VP of Growth", email: "daniel@shiplane.io", linkedin: "https://linkedin.com/in/dokafor", country: "United States", companySize: "51-200", stage: "INTERESTED" },
  { name: "Sofia Herrera", company: "Ledgerly", website: "https://ledgerly.com", industry: "Fintech", position: "Head of Sales", email: "sofia@ledgerly.com", linkedin: "https://linkedin.com/in/sofiaherrera", country: "Spain", companySize: "51-200", stage: "PROPOSAL" },
  { name: "James Whitfield", company: "Kanari HR", website: "https://kanari.hr", industry: "HR & Recruiting", position: "Founder", email: "james@kanari.hr", linkedin: "https://linkedin.com/in/jwhitfield", country: "United Kingdom", companySize: "1-10", stage: "CONTACTED" },
  { name: "Anika Rao", company: "Datastride", website: "https://datastride.io", industry: "Data & Analytics", position: "CEO", email: "anika@datastride.io", linkedin: "https://linkedin.com/in/anikarao", country: "India", companySize: "11-50", stage: "WON" },
  { name: "Lucas Meyer", company: "Sequenza", website: "https://sequenza.dev", industry: "Developer Tools", position: "CTO", email: "lucas@sequenza.dev", linkedin: "https://linkedin.com/in/lucasmeyer", country: "Germany", companySize: "11-50", stage: "CONTACTED" },
  { name: "Emily Tran", company: "Brightcart", website: "https://brightcart.com", industry: "E-commerce", position: "COO", email: "emily@brightcart.com", linkedin: "https://linkedin.com/in/emilytran", country: "United States", companySize: "201-1000", stage: "INTERESTED" },
  { name: "Oliver Bennett", company: "Vaultic", website: "https://vaultic.io", industry: "Cybersecurity", position: "Head of Partnerships", email: "oliver@vaultic.io", linkedin: "https://linkedin.com/in/oliverbennett", country: "Canada", companySize: "51-200", stage: "NEW_LEAD" },
  { name: "Chloé Dubois", company: "Pipeforge", website: "https://pipeforge.app", industry: "Sales & Marketing", position: "Founder & CEO", email: "chloe@pipeforge.app", linkedin: "https://linkedin.com/in/chloedubois", country: "France", companySize: "1-10", stage: "MEETING" },
  { name: "Marcus Hale", company: "Quantiv Health", website: "https://quantiv.health", industry: "Healthcare", position: "VP Engineering", email: "marcus@quantiv.health", linkedin: "https://linkedin.com/in/marcushale", country: "United States", companySize: "201-1000", stage: "NEW_LEAD" },
  { name: "Yuki Nakamura", company: "Flowdeck", website: "https://flowdeck.jp", industry: "Productivity", position: "CEO", email: "yuki@flowdeck.jp", linkedin: "https://linkedin.com/in/yukinakamura", country: "Japan", companySize: "11-50", stage: "CONTACTED" },
  { name: "Isabella Rossi", company: "Meridian Labs", website: "https://meridianlabs.ai", industry: "AI / Machine Learning", position: "Head of Product", email: "isabella@meridianlabs.ai", linkedin: "https://linkedin.com/in/isabellarossi", country: "Italy", companySize: "11-50", stage: "LOST" },
  { name: "Tom Eriksen", company: "Signalhouse", website: "https://signalhouse.io", industry: "Data & Analytics", position: "Co-founder", email: "tom@signalhouse.io", linkedin: "https://linkedin.com/in/tomeriksen", country: "Denmark", companySize: "1-10", stage: "NEW_LEAD" },
  { name: "Priya Sharma", company: "Cloudmint", website: "https://cloudmint.io", industry: "Fintech", position: "Director of Ops", email: "priya@cloudmint.io", linkedin: "https://linkedin.com/in/priyasharma", country: "Singapore", companySize: "51-200", stage: "INTERESTED" },
] as const;

async function main() {
  // Reset the demo org only
  const existing = await db.user.findUnique({ where: { clerkId: DEMO_CLERK_ID } });
  if (existing) {
    await db.organization.delete({ where: { id: existing.orgId } });
  }

  const org = await db.organization.create({
    data: {
      name: "Acme Labs",
      website: "https://acmelabs.dev",
      industry: "AI / Machine Learning",
      description:
        "Acme Labs builds an AI copilot that helps engineering teams review code 4x faster.",
      senderName: "Alex Carter",
      senderEmail: "alex@acmelabs.dev",
      settings: { create: { emailSignature: "Best,\nAlex Carter\nCo-founder, Acme Labs" } },
      users: {
        create: {
          clerkId: DEMO_CLERK_ID,
          email: "alex@acmelabs.dev",
          name: "Alex Carter",
          role: "owner",
        },
      },
    },
  });

  const createdProspects = [];
  for (let i = 0; i < prospects.length; i++) {
    const p = prospects[i];
    createdProspects.push(
      await db.prospect.create({
        data: { ...p, orgId: org.id, createdAt: daysAgo(28 - i * 2) },
      })
    );
  }

  const campaignA = await db.campaign.create({
    data: {
      orgId: org.id,
      name: "AI Startups — Q3 Outbound",
      description: "Founders and growth leads at AI-native startups (11–200 people).",
      goal: "Book a 20-minute discovery call",
      tone: "professional",
      status: "ACTIVE",
      createdAt: daysAgo(24),
    },
  });

  const campaignB = await db.campaign.create({
    data: {
      orgId: org.id,
      name: "DevTools founders — warm intro angle",
      description: "Developer tools companies that raised in the last 12 months.",
      goal: "Start a conversation about code review workflow",
      tone: "friendly",
      status: "ACTIVE",
      createdAt: daysAgo(14),
    },
  });

  // Emails with varied statuses spread over the last ~3 weeks
  const emailPlan: {
    prospectIdx: number;
    campaign: string;
    status: string;
    sentDaysAgo: number | null;
    opened?: boolean;
    replied?: boolean;
  }[] = [
    { prospectIdx: 0, campaign: campaignA.id, status: "REPLIED", sentDaysAgo: 21, opened: true, replied: true },
    { prospectIdx: 1, campaign: campaignA.id, status: "OPENED", sentDaysAgo: 20, opened: true },
    { prospectIdx: 2, campaign: campaignA.id, status: "REPLIED", sentDaysAgo: 19, opened: true, replied: true },
    { prospectIdx: 3, campaign: campaignA.id, status: "SENT", sentDaysAgo: 17 },
    { prospectIdx: 4, campaign: campaignA.id, status: "REPLIED", sentDaysAgo: 16, opened: true, replied: true },
    { prospectIdx: 6, campaign: campaignA.id, status: "OPENED", sentDaysAgo: 12, opened: true },
    { prospectIdx: 8, campaign: campaignA.id, status: "REPLIED", sentDaysAgo: 11, opened: true, replied: true },
    { prospectIdx: 11, campaign: campaignA.id, status: "OPENED", sentDaysAgo: 10, opened: true },
    { prospectIdx: 5, campaign: campaignB.id, status: "SENT", sentDaysAgo: 8 },
    { prospectIdx: 10, campaign: campaignB.id, status: "OPENED", sentDaysAgo: 6, opened: true },
    { prospectIdx: 13, campaign: campaignB.id, status: "OPENED", sentDaysAgo: 4, opened: true },
    { prospectIdx: 9, campaign: campaignB.id, status: "SENT", sentDaysAgo: 2 },
    { prospectIdx: 7, campaign: campaignB.id, status: "DRAFT", sentDaysAgo: null },
    { prospectIdx: 12, campaign: campaignB.id, status: "DRAFT", sentDaysAgo: null },
  ];

  for (const plan of emailPlan) {
    const p = createdProspects[plan.prospectIdx];
    const sentAt = plan.sentDaysAgo !== null ? daysAgo(plan.sentDaysAgo) : null;
    const email = await db.email.create({
      data: {
        orgId: org.id,
        campaignId: plan.campaign,
        prospectId: p.id,
        subject: `Quick idea for ${p.company}'s code review workflow`,
        body: `Hi ${p.name.split(" ")[0]},\n\nI noticed ${p.company} has been growing its engineering team — congrats on the momentum.\n\nMost teams your size lose 6–10 hours a week to slow code reviews. Acme Labs plugs into your GitHub and cuts review time by ~4x, without changing how your team works.\n\nWorth a quick 20-minute look next week?\n\nBest,\nAlex Carter\nCo-founder, Acme Labs`,
        status: plan.status,
        sentAt,
        openedAt: plan.opened && plan.sentDaysAgo !== null ? daysAgo(plan.sentDaysAgo - 1, 14) : null,
        repliedAt: plan.replied && plan.sentDaysAgo !== null ? daysAgo(plan.sentDaysAgo - 2, 16) : null,
        createdAt: sentAt ?? daysAgo(1),
      },
    });

    if (plan.status === "SENT" && plan.sentDaysAgo !== null && plan.sentDaysAgo > 5) {
      await db.followUp.create({
        data: {
          emailId: email.id,
          sequence: 1,
          tone: "friendly",
          cta: "Offer a 2-line teardown of their current workflow",
          subject: `Re: Quick idea for ${p.company}'s code review workflow`,
          body: `Hi ${p.name.split(" ")[0]},\n\nFloating this back up — I recorded a 90-second teardown of how ${p.company} could shave cycle time off reviews. Want me to send it over?\n\nBest,\nAlex`,
          status: "SENT",
          sentAt: daysAgo(plan.sentDaysAgo - 3, 9),
        },
      });
    }
  }

  // Activity feed
  const activities: { type: string; description: string; days: number; prospectIdx?: number }[] = [
    { type: "email_replied", description: "Maya Lindqvist (Nordform AI) replied to “AI Startups — Q3 Outbound”", days: 1, prospectIdx: 0 },
    { type: "stage_changed", description: "Chloé Dubois moved to Meeting", days: 1, prospectIdx: 8 },
    { type: "email_opened", description: "Priya Sharma (Cloudmint) opened your email 3 times", days: 2, prospectIdx: 13 },
    { type: "followup_sent", description: "Follow-up #1 sent to Lucas Meyer (Sequenza)", days: 3, prospectIdx: 5 },
    { type: "email_replied", description: "Sofia Herrera (Ledgerly) replied — asked for pricing", days: 4, prospectIdx: 2 },
    { type: "stage_changed", description: "Anika Rao (Datastride) marked as Won 🎉", days: 5, prospectIdx: 4 },
    { type: "email_sent", description: "12 emails sent in “DevTools founders — warm intro angle”", days: 6 },
    { type: "ai_generated", description: "AI personalization generated for 6 prospects", days: 7 },
  ];
  for (const a of activities) {
    await db.activity.create({
      data: {
        orgId: org.id,
        prospectId: a.prospectIdx !== undefined ? createdProspects[a.prospectIdx].id : null,
        type: a.type,
        description: a.description,
        createdAt: daysAgo(a.days, 9 + a.days),
      },
    });
  }

  await db.insight.createMany({
    data: [
      {
        orgId: org.id,
        kind: "opportunity",
        title: "Cloudmint and Brightcart are your hottest opens",
        body: "Priya Sharma opened your email 3 times in 48 hours and Emily Tran twice. Multiple opens without a reply usually means internal forwarding — send a short, low-friction follow-up with a concrete time suggestion.",
        createdAt: daysAgo(1, 8),
      },
      {
        orgId: org.id,
        kind: "action",
        title: "James Whitfield is going cold",
        body: "Contacted 17 days ago with no follow-up sent. Prospects in HR & Recruiting in your pipeline reply 2.1x more often after a second touch. Queue follow-up #1 with a friendly tone.",
        createdAt: daysAgo(1, 8),
      },
      {
        orgId: org.id,
        kind: "warning",
        title: "Reply rate dipped week-over-week",
        body: "Replies fell from 3 to 1 over the last 7 days while volume stayed flat. The drop is concentrated in the DevTools campaign — its subject line has a 33% lower open rate. Try a subject that references the prospect's stack.",
        createdAt: daysAgo(2, 8),
      },
    ],
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Revenue Intelligence layer
  // ═══════════════════════════════════════════════════════════════════════

  // An ICP gives the scorer something to measure fit against, and gives
  // deal-value estimation a range to work from.
  await db.icpProfile.create({
    data: {
      orgId: org.id,
      completed: true,
      offering: "An AI copilot that cuts engineering code-review time by ~4x.",
      idealCustomer:
        "Venture-backed software companies with 11-200 engineers who ship daily and feel review latency.",
      dealValueMin: 6_000,
      dealValueMax: 40_000,
      regions: "United States, United Kingdom, Germany, Sweden, France, Spain",
      industries:
        "AI / Machine Learning, Developer Tools, Fintech, Data & Analytics, Sales & Marketing",
      companySizes: "11-50, 51-200, 201-1000",
      buyerTitles: "CTO, VP Engineering, Head of Engineering, Founder, CEO, VP of Growth",
      signals: "hiring engineers, recently funded, shipping frequently",
      exclusions: "Agencies, sub-10-person teams without a dedicated eng lead",
      autonomy: "approve",
    },
  });

  const demoSource = await db.signalSource.upsert({
    where: { key: "mock_demo" },
    update: {},
    create: {
      key: "mock_demo",
      name: "Demo data",
      kind: "mock",
      description:
        "Illustrative signals for the demo workspace. Never presented as real detections.",
    },
  });

  /** Matches lib/intent/signals.ts — same inputs must collapse to one row. */
  const dedupeKey = (signalType: string, title: string, occurredAt: Date) =>
    crypto
      .createHash("sha1")
      .update(
        `${signalType}|${title.trim().toLowerCase().replace(/\s+/g, " ")}|${occurredAt
          .toISOString()
          .slice(0, 10)}`
      )
      .digest("hex")
      .slice(0, 24);

  interface DemoSignal {
    type: SignalType;
    title: string;
    evidence?: string;
    daysAgo: number;
    hour?: number;
    confidence?: "low" | "medium" | "high";
  }

  /**
   * One scenario per leak rule, so the Recover page demonstrates every
   * category and the Overview leads with a believable number.
   */
  const scenarios: {
    prospectIdx: number;
    stage: string;
    dealValue: number;
    /** null ⇒ the deal has never been contacted. */
    lastInteractionDaysAgo: number | null;
    lastInteractionKind?: string;
    nextStepDaysFromNow?: number | null;
    closedDaysAgo?: number;
    signals: DemoSignal[];
    note: string;
  }[] = [
    {
      // §4's headline example: proposal opened, nobody followed up.
      prospectIdx: 0, // Nordform AI — Maya Lindqvist
      stage: "PROPOSAL",
      dealValue: 24_000,
      lastInteractionDaysAgo: 4,
      lastInteractionKind: "email_opened",
      // The proposal open must predate the follow-up window for the leak to
      // fire — 4 days matches the copy and clears proposalFollowUpDays.
      nextStepDaysFromNow: null,
      signals: [
        { type: "proposal_opened", title: "Proposal opened", evidence: "Opened 2× in 24 hours", daysAgo: 4, hour: 13, confidence: "high" },
        { type: "pricing_page_viewed", title: "Pricing page viewed", evidence: "3 visits this week", daysAgo: 2, hour: 14, confidence: "high" },
        { type: "meeting_attended", title: "Discovery call completed", daysAgo: 11, confidence: "high" },
      ],
      note: "proposal opened, no follow-up for 4 days",
    },
    {
      // High-intent prospect with a second stakeholder — §4's second example.
      prospectIdx: 2, // Ledgerly — Sofia Herrera
      stage: "NEGOTIATION",
      dealValue: 18_000,
      lastInteractionDaysAgo: 2,
      lastInteractionKind: "email_replied",
      nextStepDaysFromNow: 2,
      signals: [
        { type: "multi_stakeholder", title: "VP Finance joined the evaluation", evidence: "Second stakeholder from the same domain", daysAgo: 2, confidence: "high" },
        { type: "pricing_page_viewed", title: "Pricing page viewed", evidence: "2 visits", daysAgo: 3, confidence: "high" },
        { type: "email_replied", title: "Replied asking about pricing", daysAgo: 2, confidence: "high" },
      ],
      note: "healthy — strong intent, being worked properly",
    },
    {
      // High intent, never replied.
      prospectIdx: 13, // Cloudmint — Priya Sharma
      stage: "QUALIFYING",
      dealValue: 12_000,
      lastInteractionDaysAgo: 6,
      lastInteractionKind: "email_opened",
      signals: [
        { type: "pricing_page_viewed", title: "Pricing page viewed", evidence: "2 visits in 3 days", daysAgo: 2, confidence: "high" },
        { type: "repeat_site_visit", title: "Returned to the site", evidence: "4th visit this month", daysAgo: 3, confidence: "high" },
        { type: "demo_page_viewed", title: "Demo page viewed", daysAgo: 4, confidence: "medium" },
        { type: "funding_round", title: "Raised a Series A", evidence: "$12M announced", daysAgo: 20, confidence: "high" },
      ],
      note: "high intent, no response",
    },
    {
      // Meeting completed, nothing scheduled after it.
      prospectIdx: 6, // Brightcart — Emily Tran
      stage: "MEETING",
      dealValue: 16_000,
      lastInteractionDaysAgo: 6,
      lastInteractionKind: "meeting",
      nextStepDaysFromNow: null,
      signals: [
        { type: "meeting_attended", title: "Demo completed", evidence: "45-minute product walkthrough", daysAgo: 6, confidence: "high" },
        { type: "headcount_growth", title: "Engineering headcount up 30%", daysAgo: 25, confidence: "medium" },
      ],
      note: "meeting completed, no next step",
    },
    {
      // Going cold after real engagement.
      prospectIdx: 3, // Kanari HR — James Whitfield
      stage: "QUALIFYING",
      dealValue: 8_500,
      lastInteractionDaysAgo: 17,
      lastInteractionKind: "email_sent",
      signals: [
        { type: "job_surge", title: "5 new engineering roles posted", daysAgo: 22, confidence: "medium" },
      ],
      note: "going cold — 17 days of silence",
    },
    {
      // Overdue next step.
      prospectIdx: 1, // Shiplane — Daniel Okafor
      stage: "PROPOSAL",
      dealValue: 21_000,
      lastInteractionDaysAgo: 8,
      lastInteractionKind: "email_opened",
      nextStepDaysFromNow: -3,
      signals: [
        { type: "proposal_opened", title: "Proposal opened", daysAgo: 7, confidence: "high" },
        { type: "hiring_velocity_up", title: "Hiring pace increasing", daysAgo: 18, confidence: "medium" },
      ],
      note: "follow-up 3 days overdue",
    },
    {
      // Closed lost, then came back.
      prospectIdx: 11, // Meridian Labs — Isabella Rossi
      stage: "LOST",
      dealValue: 14_000,
      lastInteractionDaysAgo: 45,
      lastInteractionKind: "email_sent",
      closedDaysAgo: 40,
      signals: [
        { type: "pricing_page_viewed", title: "Pricing page viewed", evidence: "First visit since the deal closed", daysAgo: 3, confidence: "high" },
        { type: "leadership_change", title: "New VP Engineering appointed", daysAgo: 12, confidence: "medium" },
      ],
      note: "previously lost, new buying signal",
    },
    {
      // Won — gives the Impact page something real to report.
      prospectIdx: 4, // Datastride — Anika Rao
      stage: "WON",
      dealValue: 22_000,
      lastInteractionDaysAgo: 5,
      lastInteractionKind: "email_replied",
      closedDaysAgo: 5,
      signals: [
        { type: "meeting_attended", title: "Contract call completed", daysAgo: 7, confidence: "high" },
      ],
      note: "closed won this month",
    },
    {
      // Healthy early deal — proves the product also says "do nothing".
      prospectIdx: 8, // Pipeforge — Chloé Dubois
      stage: "MEETING",
      dealValue: 9_000,
      lastInteractionDaysAgo: 1,
      lastInteractionKind: "email_replied",
      nextStepDaysFromNow: 4,
      signals: [
        { type: "meeting_attended", title: "Discovery call completed", daysAgo: 2, confidence: "high" },
        { type: "email_replied", title: "Replied to confirm next steps", daysAgo: 1, confidence: "high" },
      ],
      note: "healthy — nothing to do",
    },
  ];

  let opportunityCount = 0;
  const wonOpportunityIds: string[] = [];

  /** Everything the loop seeding below needs, collected as deals are built. */
  const demoDeals: {
    opportunityId: string;
    accountId: string;
    contactId: string;
    stage: string;
    dealValue: number;
    signalIds: string[];
  }[] = [];
  const savedOpportunities: {
    id: string;
    expected: number;
    headline: string;
    signalIds: string[];
  }[] = [];

  for (const s of scenarios) {
    const p = createdProspects[s.prospectIdx];

    const account = await db.account.create({
      data: {
        orgId: org.id,
        name: p.company,
        domain: p.website?.replace(/^https?:\/\//, "") ?? null,
        industry: p.industry,
        companySize: p.companySize,
        region: p.country,
        source: "imported",
        verified: true,
      },
    });
    await db.prospect.update({
      where: { id: p.id },
      data: { accountId: account.id },
    });

    // ── Signals ──
    // Created before the opportunity exists, so the opportunity link is
    // backfilled below — mirroring real ingestion, where a signal often
    // arrives before anyone has opened a deal for it.
    const seededSignalIds: string[] = [];
    for (const sig of s.signals) {
      const occurredAt = daysAgo(sig.daysAgo, sig.hour ?? 11);
      const ttl = SIGNAL_TTL_DAYS[sig.type] ?? 60;
      const created = await db.buyingSignal.create({
        data: {
          orgId: org.id,
          accountId: account.id,
          signalType: sig.type,
          title: sig.title,
          evidence: sig.evidence ?? null,
          sourceId: demoSource.id,
          occurredAt,
          confidence: sig.confidence ?? "medium",
          dedupeKey: dedupeKey(sig.type, sig.title, occurredAt),
          expiresAt: new Date(occurredAt.getTime() + ttl * 86_400_000),
          confidenceScore: CONFIDENCE_SCORES[sig.confidence ?? "medium"],
          importanceScore: signalImportance(sig.type),
        },
      });
      seededSignalIds.push(created.id);
    }

    // ── Opportunity ──
    const lastInteractionAt =
      s.lastInteractionDaysAgo != null ? daysAgo(s.lastInteractionDaysAgo, 15) : null;

    const opp = await db.opportunity.create({
      data: {
        orgId: org.id,
        accountId: account.id,
        primaryContactId: p.id,
        name: `${p.company} — new business`,
        stage: s.stage,
        source: "derived_from_prospect",
        dealValue: s.dealValue,
        dealValueBasis: "user_entered",
        lastInteractionAt,
        lastInteractionKind: s.lastInteractionKind ?? null,
        nextStepDueAt:
          s.nextStepDaysFromNow != null
            ? new Date(Date.now() + s.nextStepDaysFromNow * 86_400_000)
            : null,
        closedAt: s.closedDaysAgo != null ? daysAgo(s.closedDaysAgo) : null,
      },
    });
    opportunityCount++;

    // Backfill the deal link now that the opportunity exists.
    await db.buyingSignal.updateMany({
      where: { id: { in: seededSignalIds } },
      data: { opportunityId: opp.id },
    });

    demoDeals.push({
      opportunityId: opp.id,
      accountId: account.id,
      contactId: p.id,
      stage: s.stage,
      dealValue: s.dealValue,
      signalIds: seededSignalIds,
    });

    // ── Score it with the real engine, so demo numbers are honest ──
    const emails = await db.email.findMany({
      where: { orgId: org.id, prospectId: p.id },
      select: { sentAt: true, openedAt: true, repliedAt: true },
    });
    const replied = emails.filter((e) => e.repliedAt).length;

    const result = computeOpportunityScore({
      stage: s.stage,
      dealValue: s.dealValue,
      signals: s.signals.map((sig) => ({
        signalType: sig.type,
        occurredAt: daysAgo(sig.daysAgo, sig.hour ?? 11),
        confidence: sig.confidence ?? "medium",
      })),
      fit: {
        industryMatch: true,
        companySizeMatch: ["11-50", "51-200", "201-1000"].includes(p.companySize ?? ""),
        regionMatch: true,
        buyerTitleMatch: /CTO|VP|Founder|CEO|Head/i.test(p.position ?? ""),
      },
      engagement: {
        emailsOpened: emails.filter((e) => e.openedAt).length,
        emailsReplied: replied,
        meetingsHeld: s.signals.some((x) => x.type === "meeting_attended") ? 1 : 0,
        proposalsSent: s.signals.some((x) => x.type === "proposal_opened") ? 1 : 0,
        siteVisits: s.signals.filter((x) =>
          ["pricing_page_viewed", "demo_page_viewed", "repeat_site_visit"].includes(x.type)
        ).length,
        unansweredOutbound: replied > 0 ? 0 : emails.filter((e) => e.sentAt).length,
      },
      lastInteractionAt,
      theyRepliedLast: s.lastInteractionKind === "email_replied",
      icpDealRange: { min: 6_000, max: 40_000 },
    });

    await db.opportunityScoreSnapshot.create({
      data: {
        orgId: org.id,
        opportunityId: opp.id,
        score: result.score,
        band: result.band,
        confidence: result.confidence,
        winProbability: result.winProbability,
        expectedValue: result.expectedValue,
        whyNow: result.whyNow.join("\n"),
        version: result.version,
        factors: {
          create: result.factors.map((f) => ({
            dimension: f.dimension,
            ruleKey: f.ruleKey,
            label: f.label,
            points: f.points,
            reason: f.reason,
          })),
        },
      },
    });

    await db.opportunity.update({
      where: { id: opp.id },
      data: {
        score: result.score,
        scoreBand: result.band,
        confidence: result.confidence,
        winProbability: result.winProbability,
        whyNow: result.whyNow.join("\n"),
        scoredAt: new Date(),
      },
    });

    if (s.stage === "WON") wonOpportunityIds.push(opp.id);
    if (s.note.startsWith("healthy"))
      savedOpportunities.push({
        id: opp.id,
        expected: expectedRevenue(s.dealValue, result.winProbability),
        headline: `Follow up with ${p.name.split(" ")[0]} at ${p.company}`,
        signalIds: seededSignalIds,
      });
  }

  // ── A little worked history, so Impact reports facts rather than zeros ──
  for (const saved of savedOpportunities) {
    const rec = await db.recommendation.create({
      data: {
        orgId: org.id,
        opportunityId: saved.id,
        dedupeKey: "seed:worked",
        actionType: "follow_up",
        headline: saved.headline,
        rationale:
          "Buying signals spiked and the deal had gone quiet — Selryn surfaced it and the follow-up went out the same day.",
        urgency: "today",
        leakType: "going_cold",
        expectedValue: saved.expected,
        dealValue: saved.expected,
        // Evidence and priority, so this legacy demo row renders the same way
        // the engine's own recommendations do rather than showing a bare 0.
        supportingSignals: JSON.stringify(saved.signalIds.slice(0, 2)),
        confidence: saved.signalIds.length >= 2 ? "high" : "medium",
        priorityScore: 72,
        expectedImpact:
          "Demo data — a worked recommendation, kept so Impact reports facts rather than zeros.",
        status: "COMPLETED",
        completedAt: daysAgo(3),
        completedBy: "demo_user",
        createdAt: daysAgo(4),
      },
    });
    await db.revenueAttribution.create({
      data: {
        orgId: org.id,
        opportunityId: saved.id,
        recommendationId: rec.id,
        kind: "saved",
        amount: saved.expected,
        reason: `Acted on "${saved.headline}" — recovered a deal flagged as going cold.`,
        occurredAt: daysAgo(3),
      },
    });
  }

  for (const wonId of wonOpportunityIds) {
    const won = await db.opportunity.findUniqueOrThrow({ where: { id: wonId } });
    await db.revenueAttribution.create({
      data: {
        orgId: org.id,
        opportunityId: wonId,
        kind: "recovered",
        amount: won.dealValue,
        reason: "Deal closed won after Selryn surfaced and recovered it.",
        occurredAt: daysAgo(5),
      },
    });
    await db.outcome.create({
      data: {
        orgId: org.id,
        accountId: won.accountId,
        opportunityId: wonId,
        stage: "won",
        detail: `${won.name} closed won`,
        occurredAt: daysAgo(5),
      },
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // The closed loop, seeded end to end.
  //
  // Recommendation → Action → Response → Outcome, on real rows, so the
  // timeline and the learning panels have something to show on first run.
  // The volume is chosen deliberately: lib/revenue/learning.ts refuses to
  // report anything below MIN_SAMPLE (12) or MIN_SLICE_SAMPLE (8), so a
  // handful of demo deals would render nothing but "Insufficient data" and
  // the feature would look broken rather than careful.
  //
  // Outcomes here are a mix of wins, losses and non-responses on purpose. A
  // demo dataset where every recommendation worked would teach the reader
  // something false about the product.
  // ══════════════════════════════════════════════════════════════════════

  const LOOP_ACTIONS = [
    { actionType: "follow_up", channel: "email", summary: "Followed up on the pricing-page visit" },
    { actionType: "call", channel: "call", summary: "Called the champion to unblock the review" },
    { actionType: "send_case_study", channel: "email", summary: "Sent the industry case study" },
    { actionType: "book_meeting", channel: "email", summary: "Proposed three times for the next call" },
    { actionType: "send_proposal", channel: "email", summary: "Sent the revised proposal" },
    { actionType: "reengage", channel: "linkedin", summary: "Re-engaged after a quiet fortnight" },
  ] as const;

  // Reaction per action index, cycled. Roughly half draw nothing — which is
  // what makes the reported rates believable rather than flattering.
  const LOOP_REACTIONS: (
    | "replied"
    | "meeting_booked"
    | "proposal_viewed"
    | "no_response"
    | "opportunity_advanced"
    | "stakeholder_added"
  )[] = [
    "replied",
    "no_response",
    "meeting_booked",
    "no_response",
    "opportunity_advanced",
    "proposal_viewed",
    "no_response",
    "stakeholder_added",
  ];

  const SENTIMENT: Record<string, string> = {
    replied: "positive",
    meeting_booked: "positive",
    proposal_viewed: "positive",
    stakeholder_added: "positive",
    opportunity_advanced: "positive",
    no_response: "negative",
  };

  let loopRecommendations = 0;
  let loopActions = 0;
  let loopResponses = 0;

  for (const [dealIndex, deal] of demoDeals.entries()) {
    // Three passes per deal gets the sample counts over the learning gates
    // without inventing companies that do not exist in the demo narrative.
    for (let pass = 0; pass < 3; pass++) {
      const spec = LOOP_ACTIONS[(dealIndex + pass) % LOOP_ACTIONS.length];
      const reaction = LOOP_REACTIONS[(dealIndex * 3 + pass) % LOOP_REACTIONS.length];

      // Walk backwards in time so older passes sit earlier on the timeline.
      const recommendedAt = daysAgo(28 - pass * 8, 9);
      const executedAt = new Date(recommendedAt.getTime() + 6 * 3_600_000);
      const respondedAt = new Date(executedAt.getTime() + 20 * 3_600_000);

      const expectedValue = Math.round(deal.dealValue * 0.4);
      const evidence = deal.signalIds.slice(0, 2);

      const rec = await db.recommendation.create({
        data: {
          orgId: org.id,
          opportunityId: deal.opportunityId,
          actionType: spec.actionType,
          headline: spec.summary,
          rationale:
            "Demo data — generated to illustrate the recommendation → action → response chain.",
          urgency: pass === 0 ? "today" : "this_week",
          expectedValue,
          dealValue: deal.dealValue,
          supportingSignals: JSON.stringify(evidence),
          confidence: evidence.length >= 2 ? "high" : "medium",
          priorityScore: 40 + ((dealIndex * 7 + pass * 11) % 55),
          status: "COMPLETED",
          completedAt: executedAt,
          completedBy: "seed",
          dedupeKey: `seed-${deal.opportunityId}-${pass}`,
          createdAt: recommendedAt,
        },
      });
      loopRecommendations++;

      const action = await db.action.create({
        data: {
          orgId: org.id,
          opportunityId: deal.opportunityId,
          recommendationId: rec.id,
          contactId: deal.contactId,
          actionType: spec.actionType,
          channel: spec.channel,
          summary: spec.summary,
          executionStatus: "EXECUTED",
          proposedAt: recommendedAt,
          approvedAt: executedAt,
          executedAt,
          approvedBy: "seed",
          // Every third draft was rewritten — the edit rate is a real number
          // in the demo, not a flattering zero.
          humanEdited: (dealIndex + pass) % 3 === 0,
          createdAt: recommendedAt,
        },
      });
      loopActions++;

      await db.response.create({
        data: {
          orgId: org.id,
          opportunityId: deal.opportunityId,
          actionId: action.id,
          recommendationId: rec.id,
          contactId: deal.contactId,
          responseType: reaction,
          sentiment: SENTIMENT[reaction] ?? "neutral",
          detail: "Demo data",
          hoursToRespond: reaction === "no_response" ? null : 20,
          observedAt: reaction === "no_response" ? new Date(executedAt.getTime() + 72 * 3_600_000) : respondedAt,
        },
      });
      loopResponses++;
    }
  }

  // Closed outcomes on the deals that are already terminal, so the
  // signal→win-rate comparison has both halves to compare.
  for (const deal of demoDeals) {
    if (deal.stage !== "WON" && deal.stage !== "LOST") continue;
    const isWon = deal.stage === "WON";
    const closedAt = daysAgo(4);
    const existing = await db.outcome.findFirst({
      where: { opportunityId: deal.opportunityId, stage: isWon ? "won" : "lost" },
      select: { id: true },
    });
    if (existing) {
      // The won-deal block above already wrote a row; enrich it rather than
      // duplicating, so revenue is not double-counted.
      await db.outcome.update({
        where: { id: existing.id },
        data: { revenueAmount: isWon ? deal.dealValue : null, salesCycleDays: 34 },
      });
      continue;
    }
    await db.outcome.create({
      data: {
        orgId: org.id,
        accountId: deal.accountId,
        opportunityId: deal.opportunityId,
        stage: isWon ? "won" : "lost",
        detail: "Demo data",
        revenueAmount: isWon ? deal.dealValue : null,
        salesCycleDays: 34,
        lossReason: isWon ? null : "timing",
        occurredAt: closedAt,
      },
    });
  }

  console.log(
    `Seeded the closed loop — ${loopRecommendations} recommendations, ${loopActions} actions, ${loopResponses} responses.`
  );

  console.log(
    `Seeded demo workspace “${org.name}” — ${prospects.length} prospects, ${opportunityCount} opportunities with signals and scores.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
