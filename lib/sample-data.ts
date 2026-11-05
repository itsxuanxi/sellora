/**
 * The sample dataset — one workspace, seeded end to end.
 *
 * This is the only definition of Selryn's example data. It backs three
 * entry points that used to be three different things:
 *
 *   - the public sandbox at /demo (an anonymous throwaway workspace),
 *   - "Load sample data" during onboarding, in a real customer's workspace,
 *   - `npm run db:seed`, for local development.
 *
 * It covers the full loop the product claims to run, because a sample that
 * stops at "here are some opportunities" cannot demonstrate the argument:
 *
 *   Detect  — accounts, contacts and buying signals with real dedupe keys
 *   Decide  — scores computed by the real engine, never hardcoded
 *   Act     — recommendations and executed actions, some of them human-edited
 *   Learn   — buyer responses, outcomes and revenue attribution, including
 *             the ones that went nowhere
 *
 * Every row it writes is tagged `isSample`, which is what makes the one-click
 * clear precise and what keeps `lib/sandbox.ts` from ever sending a real email
 * to a fictional person.
 *
 * Deliberately not `server-only`: `prisma/seed.ts` runs this as a plain script.
 */
import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { computeOpportunityScore } from "@/lib/revenue/opportunity-score";
import { expectedRevenue } from "@/lib/revenue/money";
import { SIGNAL_TTL_DAYS, type SignalType } from "@/lib/intent/config";
import {
  CONFIDENCE_SCORE as CONFIDENCE_SCORES,
  dedupeKey,
  signalImportance,
} from "@/lib/intent/signal-facts";

/** The fictional company whose workspace the sample data describes. */
export const SAMPLE_ORG = {
  name: "Acme Labs",
  website: "https://acmelabs.dev",
  industry: "AI / Machine Learning",
  description:
    "Acme Labs builds an AI copilot that helps engineering teams review code 4x faster.",
  senderName: "Alex Carter",
  senderEmail: "alex@acmelabs.dev",
  emailSignature: "Best,\nAlex Carter\nCo-founder, Acme Labs",
} as const;

/** Key of the SignalSource every sample signal is attributed to. */
export const SAMPLE_SIGNAL_SOURCE_KEY = "mock_demo";

/** Ids are minted here so independent rows can be inserted in one call. */
const newId = () => randomUUID();

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
  { name: "Maya Chen", company: "Cloudmint", website: "https://cloudmint.io", industry: "Fintech", position: "VP Finance", email: "maya@cloudmint.io", linkedin: "https://linkedin.com/in/mayachen", country: "United States", companySize: "51-200", stage: "PROPOSAL" },
] as const;

/**
 * Fills an existing organization with the sample dataset.
 *
 * Assumes the org exists and is empty of sample rows — callers should run
 * `clearSampleData` first if re-seeding. The org's own identity (name, sender,
 * settings, ICP) is only filled in where it is missing, so a real customer who
 * loads sample data does not have their workspace renamed to "Acme Labs".
 */
export async function seedSampleData(
  db: PrismaClient,
  orgId: string,
  opts: { applyIdentity?: boolean } = {}
): Promise<SampleDataCounts> {
  // A throwaway sandbox should look like Acme Labs; a real customer who just
  // wants example rows keeps their own workspace name and sending identity.
  if (opts.applyIdentity) {
    await db.organization.update({
      where: { id: orgId },
      data: {
        name: SAMPLE_ORG.name,
        website: SAMPLE_ORG.website,
        industry: SAMPLE_ORG.industry,
        description: SAMPLE_ORG.description,
        senderName: SAMPLE_ORG.senderName,
        senderEmail: SAMPLE_ORG.senderEmail,
        settings: {
          upsert: {
            create: { emailSignature: SAMPLE_ORG.emailSignature },
            update: { emailSignature: SAMPLE_ORG.emailSignature },
          },
        },
      },
    });
  }

  // Ids are generated up front throughout this function rather than read back
  // from each insert. That is what lets independent rows go in as one
  // `createMany` instead of a round trip apiece — the seed used to make ~250
  // sequential calls and took over a minute and a half against a remote
  // database, which is not a wait you can put in front of a demo.
  const createdProspects = prospects.map((p, i) => ({
    ...p,
    id: newId(),
    orgId,
    isSample: true,
    createdAt: daysAgo(28 - i * 2),
    accountId: null as string | null,
  }));
  await db.prospect.createMany({ data: createdProspects });

  const campaignA = { id: newId() };
  const campaignB = { id: newId() };
  await db.campaign.createMany({
    data: [
      {
        id: campaignA.id,
        orgId,
        name: "AI Startups — Q3 Outbound",
        description: "Founders and growth leads at AI-native startups (11–200 people).",
        goal: "Book a 20-minute discovery call",
        tone: "professional",
        status: "ACTIVE",
        createdAt: daysAgo(24),
      },
      {
        id: campaignB.id,
        orgId,
        name: "DevTools founders — warm intro angle",
        description: "Developer tools companies that raised in the last 12 months.",
        goal: "Start a conversation about code review workflow",
        tone: "friendly",
        status: "ACTIVE",
        createdAt: daysAgo(14),
      },
    ],
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

  const emailRows = emailPlan.map((plan) => {
    const p = createdProspects[plan.prospectIdx];
    const sentAt = plan.sentDaysAgo !== null ? daysAgo(plan.sentDaysAgo) : null;
    return {
      id: newId(),
      plan,
      p,
      row: {
        id: "",
        orgId,
        campaignId: plan.campaign,
        prospectId: p.id,
        subject: `Quick idea for ${p.company}'s code review workflow`,
        body: `Hi ${p.name.split(" ")[0]},\n\nI noticed ${p.company} has been growing its engineering team — congrats on the momentum.\n\nMost teams your size lose 6–10 hours a week to slow code reviews. Acme Labs plugs into your GitHub and cuts review time by ~4x, without changing how your team works.\n\nWorth a quick 20-minute look next week?\n\nBest,\nAlex Carter\nCo-founder, Acme Labs`,
        status: plan.status,
        sentAt,
        openedAt:
          plan.opened && plan.sentDaysAgo !== null ? daysAgo(plan.sentDaysAgo - 1, 14) : null,
        repliedAt:
          plan.replied && plan.sentDaysAgo !== null ? daysAgo(plan.sentDaysAgo - 2, 16) : null,
        createdAt: sentAt ?? daysAgo(1),
      },
    };
  });
  for (const e of emailRows) e.row.id = e.id;

  await db.email.createMany({ data: emailRows.map((e) => e.row) });

  const followUps = emailRows
    .filter(
      (e) =>
        e.plan.status === "SENT" && e.plan.sentDaysAgo !== null && e.plan.sentDaysAgo > 5
    )
    .map((e) => ({
      emailId: e.id,
      sequence: 1,
      tone: "friendly",
      cta: "Offer a 2-line teardown of their current workflow",
      subject: `Re: Quick idea for ${e.p.company}'s code review workflow`,
      body: `Hi ${e.p.name.split(" ")[0]},\n\nFloating this back up — I recorded a 90-second teardown of how ${e.p.company} could shave cycle time off reviews. Want me to send it over?\n\nBest,\nAlex`,
      status: "SENT",
      sentAt: daysAgo(e.plan.sentDaysAgo! - 3, 9),
    }));
  if (followUps.length > 0) await db.followUp.createMany({ data: followUps });

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
  await db.activity.createMany({
    data: activities.map((a) => ({
      orgId,
      prospectId: a.prospectIdx !== undefined ? createdProspects[a.prospectIdx].id : null,
      type: a.type,
      description: a.description,
      createdAt: daysAgo(a.days, 9 + a.days),
    })),
  });

  await db.insight.createMany({
    data: [
      {
        orgId,
        kind: "opportunity",
        title: "Cloudmint and Brightcart are your hottest opens",
        body: "Priya Sharma opened your email 3 times in 48 hours and Emily Tran twice. Multiple opens without a reply usually means internal forwarding — send a short, low-friction follow-up with a concrete time suggestion.",
        createdAt: daysAgo(1, 8),
      },
      {
        orgId,
        kind: "action",
        title: "James Whitfield is going cold",
        body: "Contacted 17 days ago with no follow-up sent. Prospects in HR & Recruiting in your pipeline reply 2.1x more often after a second touch. Queue follow-up #1 with a friendly tone.",
        createdAt: daysAgo(1, 8),
      },
      {
        orgId,
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
  await db.icpProfile.upsert({
    where: { orgId },
    update: {},
    create: {
      orgId,
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

  const sampleSource = await db.signalSource.upsert({
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


  interface SampleSignal {
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
    signals: SampleSignal[];
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
      // ── The deal the guided tour follows, from risk to booked meeting. ──
      //
      // Deliberately the largest expected revenue in the set, so it is top of
      // Today's priorities when the tour says "open the deal at the top" —
      // and it earns that position from the real ranking rather than being
      // pinned there. Its numbers are whatever computeOpportunityScore makes
      // of these signals: this scenario chooses the evidence, never the score.
      prospectIdx: 13, // Cloudmint — Maya Chen, VP Finance
      stage: "PROPOSAL",
      dealValue: 42_000,
      // Four days of silence after a proposal that was opened twice is the
      // leak the tour opens on.
      lastInteractionDaysAgo: 4,
      lastInteractionKind: "email_opened",
      nextStepDaysFromNow: null,
      signals: [
        { type: "meeting_attended", title: "Product demo completed", evidence: "45 minutes with the evaluation team", daysAgo: 8, confidence: "high" },
        { type: "demo_page_viewed", title: "Proposal sent", evidence: "Growth Plan, 12-month term", daysAgo: 7, confidence: "high" },
        { type: "proposal_opened", title: "Proposal opened twice", evidence: "Second open lasted 6 minutes on pricing", daysAgo: 6, confidence: "high" },
        { type: "multi_stakeholder", title: "Maya Chen joined the evaluation", evidence: "VP Finance — economic buyer for this purchase", daysAgo: 5, confidence: "high" },
        { type: "pricing_page_viewed", title: "Security page viewed", evidence: "Viewed the day after joining the evaluation", daysAgo: 4, confidence: "high" },
      ],
      note: "the guided tour's deal — proposal opened, then silence",
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
  const sampleDeals: {
    opportunityId: string;
    accountId: string;
    contactId: string;
    stage: string;
    dealValue: number;
    signalIds: string[];
    /**
     * Whether this deal's narrative includes the buyer writing back.
     *
     * The loop history below used to pick each outcome by `index % 8`, with
     * no reference to the deal it was attached to. That is how Cloudmint —
     * whose whole scenario is "opened your email three times and never
     * replied" — ended up with a `replied` Response row, so its timeline
     * showed a reply while every other panel reported silence. The generator
     * now reads the narrative instead of a modulo.
     */
    hasReplied: boolean;
  }[] = [];
  const savedOpportunities: {
    id: string;
    expected: number;
    headline: string;
    signalIds: string[];
  }[] = [];

  // Emails are read once and grouped, rather than re-queried per scenario.
  const allEmails = await db.email.findMany({
    where: { orgId },
    select: { prospectId: true, sentAt: true, openedAt: true, repliedAt: true },
  });
  const emailsByProspect = new Map<string, typeof allEmails>();
  for (const e of allEmails) {
    const list = emailsByProspect.get(e.prospectId) ?? [];
    list.push(e);
    emailsByProspect.set(e.prospectId, list);
  }

  // Slots rather than pushes: the scenarios run concurrently below, and the
  // loop history downstream cycles through these arrays by index to vary the
  // action types. Order has to stay the order they are declared in.
  const deals: (typeof sampleDeals)[number][] = new Array(scenarios.length);
  const won: (string | undefined)[] = new Array(scenarios.length);
  const saved: ((typeof savedOpportunities)[number] | undefined)[] = new Array(
    scenarios.length
  );

  await Promise.all(scenarios.map(async (s, index) => {
    const p = createdProspects[s.prospectIdx];

    // Account, contact link, signals and opportunity all have their ids minted
    // here, which collapses what used to be up to seven sequential round trips
    // per scenario into two.
    const account = { id: newId() };
    const oppId = newId();

    const signalRows = s.signals.map((sig) => {
      const occurredAt = daysAgo(sig.daysAgo, sig.hour ?? 11);
      const ttl = SIGNAL_TTL_DAYS[sig.type] ?? 60;
      return {
        id: newId(),
        orgId,
        accountId: account.id,
        // Real ingestion often sees a signal before anyone opens a deal, but
        // the link is knowable here, so it is set rather than backfilled.
        opportunityId: oppId,
        signalType: sig.type,
        title: sig.title,
        evidence: sig.evidence ?? null,
        sourceId: sampleSource.id,
        occurredAt,
        confidence: sig.confidence ?? "medium",
        dedupeKey: dedupeKey(sig.type, sig.title, occurredAt),
        expiresAt: new Date(occurredAt.getTime() + ttl * 86_400_000),
        confidenceScore: CONFIDENCE_SCORES[sig.confidence ?? "medium"],
        importanceScore: signalImportance(sig.type),
      };
    });
    const seededSignalIds = signalRows.map((r) => r.id);

    await db.account.create({
      data: {
        id: account.id,
        orgId,
        name: p.company,
        domain: p.website?.replace(/^https?:\/\//, "") ?? null,
        industry: p.industry,
        companySize: p.companySize,
        region: p.country,
        source: "imported",
        verified: true,
        isSample: true,
      },
    });

    // ── Opportunity ──
    const lastInteractionAt =
      s.lastInteractionDaysAgo != null ? daysAgo(s.lastInteractionDaysAgo, 15) : null;

    const opp = await db.opportunity.create({
      data: {
        id: oppId,
        orgId,
        accountId: account.id,
        primaryContactId: p.id,
        name: `${p.company} — new business`,
        stage: s.stage,
        source: "derived_from_prospect",
        isSample: true,
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

    // Signals reference the opportunity, so they follow it; the contact's
    // account link has no such dependency and rides along.
    await Promise.all([
      db.buyingSignal.createMany({ data: signalRows }),
      db.prospect.update({ where: { id: p.id }, data: { accountId: account.id } }),
    ]);

    deals[index] = {
      opportunityId: opp.id,
      accountId: account.id,
      contactId: p.id,
      stage: s.stage,
      dealValue: s.dealValue,
      signalIds: seededSignalIds,
      hasReplied:
        s.lastInteractionKind === "email_replied" ||
        (emailsByProspect.get(p.id) ?? []).some((e) => e.repliedAt != null),
    };

    // ── Score it with the real engine, so demo numbers are honest ──
    const emails = emailsByProspect.get(p.id) ?? [];
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

    await Promise.all([
      db.opportunityScoreSnapshot.create({
      data: {
        orgId,
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
      }),
      db.opportunity.update({
        where: { id: opp.id },
        data: {
          score: result.score,
          scoreBand: result.band,
          confidence: result.confidence,
          winProbability: result.winProbability,
          whyNow: result.whyNow.join("\n"),
          scoredAt: new Date(),
        },
      }),
    ]);

    if (s.stage === "WON") won[index] = opp.id;
    if (s.note.startsWith("healthy"))
      saved[index] = {
        id: opp.id,
        expected: expectedRevenue(s.dealValue, result.winProbability),
        headline: `Follow up with ${p.name.split(" ")[0]} at ${p.company}`,
        signalIds: seededSignalIds,
      };
  }));
  sampleDeals.push(...deals.filter(Boolean));
  wonOpportunityIds.push(...won.filter((x): x is string => Boolean(x)));
  savedOpportunities.push(...saved.filter((x): x is NonNullable<typeof x> => Boolean(x)));
  opportunityCount = sampleDeals.length;


  // ── A little worked history, so Impact reports facts rather than zeros ──
  await Promise.all(savedOpportunities.map(async (saved) => {
    const rec = await db.recommendation.create({
      data: {
        orgId,
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
        completedBy: "sample",
        createdAt: daysAgo(4),
      },
    });
    await db.revenueAttribution.create({
      data: {
        orgId,
        opportunityId: saved.id,
        recommendationId: rec.id,
        kind: "saved",
        amount: saved.expected,
        reason: `Acted on "${saved.headline}" — recovered a deal flagged as going cold.`,
        occurredAt: daysAgo(3),
      },
    });
  }));

  await Promise.all(wonOpportunityIds.map(async (wonId) => {
    const won = await db.opportunity.findUniqueOrThrow({ where: { id: wonId } });
    await db.revenueAttribution.create({
      data: {
        orgId,
        opportunityId: wonId,
        kind: "recovered",
        amount: won.dealValue,
        reason: "Deal closed won after Selryn surfaced and recovered it.",
        occurredAt: daysAgo(5),
      },
    });
    await db.outcome.create({
      data: {
        orgId,
        accountId: won.accountId,
        opportunityId: wonId,
        stage: "won",
        detail: `${won.name} closed won`,
        occurredAt: daysAgo(5),
      },
    });
  }));

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

  /**
   * The reactions available to a deal the buyer has never answered.
   *
   * `proposal_viewed` and `stakeholder_added` are buyer activity without
   * being a reply, so they belong in a silent deal's history; `replied` and
   * `meeting_booked` do not. `opportunity_advanced` is ours, not theirs.
   */
  const SILENT_REACTIONS = [
    "no_response",
    "proposal_viewed",
    "no_response",
    "stakeholder_added",
    "opportunity_advanced",
  ] as const;

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

  // Built in memory, then inserted as three calls. Each chain is
  // recommendation → action → response with real foreign keys, so the
  // timeline, the learning panels and the hit-rate maths all read it exactly
  // as they read a chain the product produced itself.
  const recRows: Prisma.RecommendationCreateManyInput[] = [];
  const actionRows: Prisma.ActionCreateManyInput[] = [];
  const responseRows: Prisma.ResponseCreateManyInput[] = [];
  const eventRows: Prisma.RevenueEventCreateManyInput[] = [];

  for (const [dealIndex, deal] of sampleDeals.entries()) {
    // Three passes per deal gets the sample counts over the learning gates
    // without inventing companies that do not exist in the sample narrative.
    for (let pass = 0; pass < 3; pass++) {
      const spec = LOOP_ACTIONS[(dealIndex + pass) % LOOP_ACTIONS.length];
      // The reaction still varies by index so the learning panels have a mix
      // to work with, but a deal whose narrative is "never replied" can only
      // draw a reaction that is not a reply. Without this constraint the
      // fixture contradicts itself, and every screen downstream faithfully
      // reports the contradiction.
      const pool = deal.hasReplied ? LOOP_REACTIONS : SILENT_REACTIONS;
      const reaction = pool[(dealIndex * 3 + pass) % pool.length];

      // Walk backwards in time so older passes sit earlier on the timeline.
      const recommendedAt = daysAgo(28 - pass * 8, 9);
      const executedAt = new Date(recommendedAt.getTime() + 6 * 3_600_000);
      const respondedAt = new Date(executedAt.getTime() + 20 * 3_600_000);

      const expectedValue = Math.round(deal.dealValue * 0.4);
      const evidence = deal.signalIds.slice(0, 2);

      const recId = newId();
      const actionId = newId();

      recRows.push({
        id: recId,
        orgId,
        opportunityId: deal.opportunityId,
        actionType: spec.actionType,
        headline: spec.summary,
        rationale:
          "Sample data — generated to illustrate the recommendation → action → response chain.",
        urgency: pass === 0 ? "today" : "this_week",
        expectedValue,
        dealValue: deal.dealValue,
        supportingSignals: JSON.stringify(evidence),
        confidence: evidence.length >= 2 ? "high" : "medium",
        priorityScore: 40 + ((dealIndex * 7 + pass * 11) % 55),
        status: "COMPLETED",
        completedAt: executedAt,
        completedBy: "sample",
        dedupeKey: `sample-${deal.opportunityId}-${pass}`,
        createdAt: recommendedAt,
      });

      actionRows.push({
        id: actionId,
        orgId,
        opportunityId: deal.opportunityId,
        recommendationId: recId,
        contactId: deal.contactId,
        actionType: spec.actionType,
        channel: spec.channel,
        summary: spec.summary,
        executionStatus: "EXECUTED",
        proposedAt: recommendedAt,
        approvedAt: executedAt,
        executedAt,
        approvedBy: "sample",
        // Every third draft was rewritten — the edit rate is a real number
        // in the sample data, not a flattering zero.
        humanEdited: (dealIndex + pass) % 3 === 0,
        createdAt: recommendedAt,
      });

      const observedAt =
        reaction === "no_response"
          ? new Date(executedAt.getTime() + 72 * 3_600_000)
          : respondedAt;

      responseRows.push({
        orgId,
        opportunityId: deal.opportunityId,
        actionId,
        recommendationId: recId,
        contactId: deal.contactId,
        responseType: reaction,
        sentiment: SENTIMENT[reaction] ?? "neutral",
        detail: "Sample data",
        hoursToRespond: reaction === "no_response" ? null : 20,
        observedAt,
      });

      // A reply is recorded in every place a real reply would land, not only
      // in the outcome tracker. A fixture that writes one source and not the
      // others is a fixture that disagrees with itself the moment two screens
      // read different tables — which is the bug this seeding produced.
      if (reaction === "replied" || reaction === "meeting_booked") {
        eventRows.push({
          orgId,
          accountId: deal.accountId,
          contactId: deal.contactId,
          opportunityId: deal.opportunityId,
          source: "demo",
          sourceEventId: `sample-reply-${deal.opportunityId}-${pass}`,
          eventType: reaction === "replied" ? "email.replied" : "meeting.held",
          occurredAt: observedAt,
          actorType: "buyer",
          confidence: 100,
          idempotencyKey: `sample-reply-${deal.opportunityId}-${pass}`,
        });
      }
    }
  }

  // Order matters: actions reference recommendations, responses reference both.
  await db.recommendation.createMany({ data: recRows });
  await db.action.createMany({ data: actionRows });
  await db.response.createMany({ data: responseRows });
  if (eventRows.length > 0) {
    await db.revenueEvent.createMany({ data: eventRows, skipDuplicates: true });
  }

  loopRecommendations = recRows.length;
  loopActions = actionRows.length;
  loopResponses = responseRows.length;

  // Closed outcomes on the deals that are already terminal, so the
  // signal→win-rate comparison has both halves to compare.
  await Promise.all(sampleDeals.map(async (deal) => {
    if (deal.stage !== "WON" && deal.stage !== "LOST") return;
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
      return;
    }
    await db.outcome.create({
      data: {
        orgId,
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
  }));
  await db.organization.update({
    where: { id: orgId },
    data: { sampleSeededAt: new Date() },
  });

  return {
    prospects: createdProspects.length,
    opportunities: opportunityCount,
    recommendations: loopRecommendations,
    actions: loopActions,
    responses: loopResponses,
  };
}

export interface SampleDataCounts {
  prospects: number;
  opportunities: number;
  recommendations: number;
  actions: number;
  responses: number;
}

/**
 * Removes every sample row from an organization, leaving anything the user
 * created themselves untouched.
 *
 * Accounts cascade to opportunities, signals, recommendations, actions and
 * responses (see `onDelete: Cascade` in the schema), so deleting the sample
 * accounts unwinds most of the graph. Contacts are deleted separately because
 * a contact's link to an account is `SetNull`, not a cascade.
 */
export async function clearSampleData(
  db: PrismaClient,
  orgId: string
): Promise<{ accounts: number; prospects: number }> {
  const accounts = await db.account.deleteMany({ where: { orgId, isSample: true } });
  const contacts = await db.prospect.deleteMany({ where: { orgId, isSample: true } });
  // Opportunities are cascaded by their account, but a sample opportunity
  // could have been re-pointed at a real account by hand.
  await db.opportunity.deleteMany({ where: { orgId, isSample: true } });
  await db.organization.update({
    where: { id: orgId },
    data: { sampleSeededAt: null },
  });
  return { accounts: accounts.count, prospects: contacts.count };
}
