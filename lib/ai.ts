import "server-only";
import OpenAI from "openai";
import type { Campaign, Organization, Prospect } from "@prisma/client";
import type { InsightKind, Tone } from "@/lib/constants";

/**
 * All AI features route through this module. When an OpenAI key is available
 * (org-level Settings key first, then OPENAI_API_KEY) we call GPT; otherwise
 * we fall back to deterministic local generation so every feature keeps
 * working end-to-end. Results carry `source` so the UI can say which one ran.
 */

export type AiSource = "openai" | "local";

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

function getClient(orgApiKey?: string | null): OpenAI | null {
  const apiKey = orgApiKey || process.env.OPENAI_API_KEY;
  return apiKey ? new OpenAI({ apiKey }) : null;
}

async function completeJson<T>(
  client: OpenAI,
  system: string,
  user: string
): Promise<T> {
  const res = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.7,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const content = res.choices[0]?.message?.content;
  if (!content) throw new Error("Empty completion");
  return JSON.parse(content) as T;
}

function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

/** "an AI / Machine Learning" vs "a fintech" — preserves industry casing. */
function withArticle(noun: string) {
  return `${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`;
}

function orgPitch(org: Organization) {
  return (
    org.description?.trim() ||
    `${org.name} helps B2B teams grow revenue with less manual work`
  );
}

function senderSignature(org: Organization) {
  return `${org.senderName ?? "The " + org.name + " team"}\n${org.name}`;
}

// ── Personalization ────────────────────────────────────────────────────────

export interface Personalization {
  companySummary: string;
  icebreaker: string;
  outreachAngle: string;
  coldEmailSubject: string;
  coldEmailBody: string;
  linkedinMessage: string;
}

function localPersonalization(p: Prospect, org: Organization): Personalization {
  const fn = firstName(p.name);
  const role = p.position ?? "leader";
  const industry = p.industry ?? "software";
  const size = p.companySize ? ` (~${p.companySize} people)` : "";
  return {
    companySummary: `${p.company} is ${withArticle(industry)} company${size}${
      p.country ? ` based in ${p.country}` : ""
    }. As ${role}, ${fn} likely owns decisions about tooling and growth — and companies at this stage feel manual go-to-market work most acutely.`,
    icebreaker: `Saw what ${p.company} is building in ${industry} — impressive pace for a team${size ? size.replace(" (~", " of ~").replace(")", "") : ""} in that space.`,
    outreachAngle: `Lead with the operational pain ${withArticle(role)} at ${withArticle(industry)} company feels: growth is limited by hours in the day, not demand. Position ${org.name} as leverage — ${orgPitch(org).replace(/\.$/, "")} — and keep the ask tiny (20 minutes).`,
    coldEmailSubject: `Quick idea for ${p.company}`,
    coldEmailBody: `Hi ${fn},\n\nSaw what ${p.company} is building in ${industry} — impressive pace.\n\nTeams like yours usually hit the same wall: pipeline growth gets capped by manual work, not demand. ${orgPitch(org)}\n\nWorth a quick 20-minute look this week? Happy to share exactly how similar teams in ${industry} use it.\n\nBest,\n${senderSignature(org)}`,
    linkedinMessage: `Hi ${fn} — saw what ${p.company} is doing in ${industry} and wanted to connect. ${orgPitch(org)} Thought it might be relevant to what you're scaling. Open to a quick chat?`,
  };
}

export async function generatePersonalization(
  prospect: Prospect,
  org: Organization,
  orgApiKey?: string | null
): Promise<{ data: Personalization; source: AiSource }> {
  const client = getClient(orgApiKey);
  if (client) {
    try {
      const data = await completeJson<Personalization>(
        client,
        `You are an elite B2B SaaS SDR and copywriter. You write concise, specific, non-cringe outreach that gets replies. Never use buzzwords ("synergy", "revolutionize"), never flatter emptily, keep emails under 120 words, write like a sharp founder texting a peer. Return JSON with exactly these string keys: companySummary, icebreaker, outreachAngle, coldEmailSubject, coldEmailBody, linkedinMessage. coldEmailBody must be plain text with \\n\\n between paragraphs and end with the sender signature. linkedinMessage must be under 300 characters.`,
        JSON.stringify({
          seller: {
            company: org.name,
            website: org.website,
            pitch: orgPitch(org),
            senderName: org.senderName,
          },
          prospect: {
            name: prospect.name,
            company: prospect.company,
            website: prospect.website,
            industry: prospect.industry,
            position: prospect.position,
            country: prospect.country,
            companySize: prospect.companySize,
            notes: prospect.notes,
          },
        })
      );
      return { data, source: "openai" };
    } catch (err) {
      console.error("[ai] personalization failed, using local fallback:", err);
    }
  }
  return { data: localPersonalization(prospect, org), source: "local" };
}

// ── Campaign emails ────────────────────────────────────────────────────────

export interface EmailDraft {
  subject: string;
  body: string;
}

function localCampaignEmail(
  p: Prospect,
  campaign: Campaign,
  org: Organization
): EmailDraft {
  const fn = firstName(p.name);
  const goal = campaign.goal ?? "a quick 20-minute call";
  const industry = p.industry ?? "software";
  const toneOpeners: Record<string, string> = {
    professional: `I'll keep this short.`,
    friendly: `Hope the week's going well over at ${p.company}.`,
    direct: `Straight to it:`,
    witty: `I promise this is the only cold email you'll get today that respects your time.`,
  };
  return {
    subject: `${p.company} × ${org.name}`,
    body: `Hi ${fn},\n\n${toneOpeners[campaign.tone] ?? toneOpeners.professional}\n\n${orgPitch(org)} For ${industry} teams like ${p.company}, that usually means more pipeline without more headcount.\n\n${campaign.description ? campaign.description + "\n\n" : ""}Would you be open to ${goal.toLowerCase().startsWith("book") ? goal.toLowerCase().replace("book", "booking") : goal.toLowerCase()}?\n\nBest,\n${senderSignature(org)}`,
  };
}

export async function generateCampaignEmail(
  prospect: Prospect,
  campaign: Campaign,
  org: Organization,
  orgApiKey?: string | null
): Promise<{ data: EmailDraft; source: AiSource }> {
  const client = getClient(orgApiKey);
  if (client) {
    try {
      const data = await completeJson<EmailDraft>(
        client,
        `You are an elite B2B SaaS SDR. Write one personalized cold email for the campaign described. Tone: ${campaign.tone}. Under 120 words, plain text with \\n\\n paragraph breaks, specific to the prospect, no buzzwords, one clear call to action aligned with the campaign goal, end with the sender signature. Return JSON: {"subject": string, "body": string}.`,
        JSON.stringify({
          seller: { company: org.name, pitch: orgPitch(org), senderName: org.senderName },
          campaign: { name: campaign.name, description: campaign.description, goal: campaign.goal },
          prospect: {
            name: prospect.name,
            company: prospect.company,
            industry: prospect.industry,
            position: prospect.position,
            companySize: prospect.companySize,
            notes: prospect.notes,
          },
        })
      );
      return { data, source: "openai" };
    } catch (err) {
      console.error("[ai] campaign email failed, using local fallback:", err);
    }
  }
  return { data: localCampaignEmail(prospect, campaign, org), source: "local" };
}

// ── Follow-ups ─────────────────────────────────────────────────────────────

export interface FollowUpDraft {
  sequence: number;
  tone: Tone;
  cta: string;
  subject: string;
  body: string;
}

function localFollowUps(
  original: EmailDraft,
  p: Prospect,
  org: Organization
): FollowUpDraft[] {
  const fn = firstName(p.name);
  const sig = senderSignature(org);
  return [
    {
      sequence: 1,
      tone: "friendly",
      cta: "Offer a specific, low-effort next step (a 2-line summary or short video)",
      subject: `Re: ${original.subject}`,
      body: `Hi ${fn},\n\nFloating this back up in case it got buried — I know the inbox of a ${p.position ?? "founder"} is a war zone.\n\nIf a call is too much right now, happy to send a 2-line summary of how this would work for ${p.company} instead. Just reply "summary".\n\nBest,\n${sig}`,
    },
    {
      sequence: 2,
      tone: "direct",
      cta: "Reduce friction: ask a single yes/no question",
      subject: `Re: ${original.subject}`,
      body: `Hi ${fn},\n\nOne quick question so I stop guessing: is improving this a priority for ${p.company} this quarter?\n\nIf yes — I'll send over two time slots.\nIf no — tell me and I'll close the loop.\n\nBest,\n${sig}`,
    },
    {
      sequence: 3,
      tone: "witty",
      cta: "Graceful breakup with an open door",
      subject: `Closing the loop, ${fn}`,
      body: `Hi ${fn},\n\nI'll take the hint — either the timing's off or my emails are landing next to the crypto spam.\n\nI'll stop here. If ${p.company} ever wants to revisit this, my calendar and my dignity are both open: just reply to this thread.\n\nAll the best,\n${sig}`,
    },
  ];
}

export async function generateFollowUps(
  original: EmailDraft,
  prospect: Prospect,
  org: Organization,
  orgApiKey?: string | null
): Promise<{ data: FollowUpDraft[]; source: AiSource }> {
  const client = getClient(orgApiKey);
  if (client) {
    try {
      const parsed = await completeJson<{ followUps: FollowUpDraft[] }>(
        client,
        `You are an elite B2B SaaS SDR. Given an original cold email that got no reply, write a 3-step follow-up sequence. Step 1: friendly bump with a lower-effort alternative CTA. Step 2: direct, single yes/no question. Step 3: witty, graceful breakup email. Each under 90 words, plain text with \\n\\n breaks, ending with the sender signature. Return JSON: {"followUps": [{"sequence": 1|2|3, "tone": "friendly"|"direct"|"witty", "cta": string (the CTA strategy), "subject": string, "body": string}]}.`,
        JSON.stringify({
          originalEmail: original,
          seller: { company: org.name, pitch: orgPitch(org), senderName: org.senderName },
          prospect: {
            name: prospect.name,
            company: prospect.company,
            industry: prospect.industry,
            position: prospect.position,
          },
        })
      );
      if (parsed.followUps?.length) return { data: parsed.followUps.slice(0, 3), source: "openai" };
    } catch (err) {
      console.error("[ai] follow-ups failed, using local fallback:", err);
    }
  }
  return { data: localFollowUps(original, prospect, org), source: "local" };
}

// ── Insights ───────────────────────────────────────────────────────────────

export interface InsightDraft {
  kind: InsightKind;
  title: string;
  body: string;
}

export interface InsightsContext {
  totals: {
    prospects: number;
    emailsSent: number;
    opened: number;
    replied: number;
    meetings: number;
    won: number;
    lost: number;
  };
  replyRateThisWeek: number;
  replyRateLastWeek: number;
  stageCounts: Record<string, number>;
  hotProspects: { name: string; company: string; signal: string }[];
  staleProspects: { name: string; company: string; daysSinceContact: number }[];
  campaigns: { name: string; sent: number; opened: number; replied: number }[];
}

function localInsights(ctx: InsightsContext): InsightDraft[] {
  const out: InsightDraft[] = [];

  if (ctx.hotProspects.length > 0) {
    const names = ctx.hotProspects
      .slice(0, 3)
      .map((h) => `${h.name} (${h.company})`)
      .join(", ");
    out.push({
      kind: "opportunity",
      title: "These prospects have the highest probability of replying",
      body: `${names} ${ctx.hotProspects.length === 1 ? "is" : "are"} showing buying signals: ${ctx.hotProspects[0].signal}. Engaged-but-silent prospects convert best within 48 hours — prioritize them today.`,
    });
  }

  if (ctx.staleProspects.length > 0) {
    const s = ctx.staleProspects[0];
    out.push({
      kind: "action",
      title: `${s.name} should receive another follow-up`,
      body: `${s.name} at ${s.company} was contacted ${s.daysSinceContact} days ago with no further touch. Sequences with a second touch see roughly 2x the reply rate of one-and-done emails. ${ctx.staleProspects.length > 1 ? `${ctx.staleProspects.length - 1} more prospect(s) are in the same state.` : ""}`,
    });
  }

  const delta =
    ctx.replyRateLastWeek > 0
      ? Math.round(
          ((ctx.replyRateThisWeek - ctx.replyRateLastWeek) / ctx.replyRateLastWeek) * 100
        )
      : null;
  if (delta !== null && delta <= -10) {
    out.push({
      kind: "warning",
      title: `Reply rate dropped ${Math.abs(delta)}% week-over-week`,
      body: `Replies went from ${ctx.replyRateLastWeek.toFixed(0)}% to ${ctx.replyRateThisWeek.toFixed(0)}% of sent emails. When volume is flat but replies fall, the usual culprits are subject-line fatigue or list quality. Rotate subject lines and tighten targeting before scaling volume.`,
    });
  } else if (delta !== null && delta >= 10) {
    out.push({
      kind: "opportunity",
      title: `Reply rate is up ${delta}% week-over-week`,
      body: `Whatever changed is working — replies rose from ${ctx.replyRateLastWeek.toFixed(0)}% to ${ctx.replyRateThisWeek.toFixed(0)}%. Double down: increase daily volume by 20-30% while the message-market fit holds.`,
    });
  }

  const bestCampaign = [...ctx.campaigns]
    .filter((c) => c.sent >= 3)
    .sort((a, b) => b.replied / b.sent - a.replied / a.sent)[0];
  if (bestCampaign && bestCampaign.replied > 0) {
    out.push({
      kind: "opportunity",
      title: `“${bestCampaign.name}” is your best performing campaign`,
      body: `${bestCampaign.replied} replies from ${bestCampaign.sent} sends (${Math.round((bestCampaign.replied / bestCampaign.sent) * 100)}%). Feed it more prospects with the same profile — cloning what works beats starting new experiments.`,
    });
  }

  if (out.length === 0) {
    out.push({
      kind: "action",
      title: "Send your first campaign to unlock insights",
      body: "Sellora generates recommendations from your real outreach data. Add prospects, generate personalized emails, and send a campaign — insights will appear as replies and opens come in.",
    });
  }
  return out.slice(0, 4);
}

export async function generateInsights(
  ctx: InsightsContext,
  orgApiKey?: string | null
): Promise<{ data: InsightDraft[]; source: AiSource }> {
  const client = getClient(orgApiKey);
  if (client) {
    try {
      const parsed = await completeJson<{ insights: InsightDraft[] }>(
        client,
        `You are a revenue operations analyst for a B2B SaaS sales team. Given pipeline and outreach metrics, produce 3-4 sharp, specific, actionable insights. Each must reference concrete numbers or named prospects from the data — no generic advice. Return JSON: {"insights": [{"kind": "opportunity"|"action"|"warning", "title": string (short, punchy), "body": string (2-3 sentences with the reasoning and the recommended action)}]}.`,
        JSON.stringify(ctx)
      );
      if (parsed.insights?.length) return { data: parsed.insights.slice(0, 4), source: "openai" };
    } catch (err) {
      console.error("[ai] insights failed, using local fallback:", err);
    }
  }
  return { data: localInsights(ctx), source: "local" };
}
