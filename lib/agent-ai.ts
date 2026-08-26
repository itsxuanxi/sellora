import "server-only";
import OpenAI from "openai";
import type { Account, IcpProfile, Organization, Prospect } from "@prisma/client";

/**
 * AI for the agent layer: ICP generation, account research, explainable
 * scoring. Same philosophy as lib/ai.ts — GPT when a key exists, honest
 * deterministic fallback otherwise, and every research output carries
 * sources + confidence so nothing pretends to be verified data.
 */

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

function getClient(orgApiKey?: string | null): OpenAI | null {
  const apiKey = orgApiKey || process.env.OPENAI_API_KEY;
  return apiKey ? new OpenAI({ apiKey }) : null;
}

async function completeJson<T>(client: OpenAI, system: string, user: string): Promise<T> {
  const res = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.4,
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

// ── ICP generation ─────────────────────────────────────────────────────────

export interface IcpDraft {
  industries: string;
  regions: string;
  companySizes: string;
  buyerTitles: string;
  signals: string;
  exclusions: string;
  aiNotes: string;
}

export interface OnboardingAnswers {
  offering: string;
  idealCustomer: string;
  dealValueMin: number | null;
  dealValueMax: number | null;
  regionsRaw: string;
}

function localIcp(a: OnboardingAnswers): IcpDraft {
  return {
    industries: "Business services",
    regions: a.regionsRaw || "United States",
    companySizes: "5-50",
    buyerTitles: "Founder, CEO, Managing Director, Head of Sales",
    signals: "Hiring for sales roles, Recently funded, New leadership, Website redesign",
    exclusions: "Enterprises (500+ employees), B2C-only businesses",
    aiNotes:
      "Generated without AI (no OpenAI key). Refine industries and buyer titles in the ICP Builder — the closer the ICP matches your best past customers, the better scoring and outreach will be.",
  };
}

export async function generateIcp(
  answers: OnboardingAnswers,
  orgApiKey?: string | null
): Promise<{ data: IcpDraft; source: "openai" | "local" }> {
  const client = getClient(orgApiKey);
  if (client) {
    try {
      const data = await completeJson<IcpDraft>(
        client,
        `You are a B2B go-to-market strategist for SMBs (5-50 employees) selling high-ticket services. From the seller's answers, produce a precise Ideal Customer Profile. Return JSON with string keys: industries (comma-separated, 3-6 specific industries), regions (comma-separated), companySizes (comma-separated employee ranges like "5-50"), buyerTitles (comma-separated, 4-8 titles that actually sign for this offering), signals (comma-separated observable buying signals, e.g. hiring patterns, funding, tech stack, leadership changes), exclusions (who to avoid and why, short), aiNotes (3-4 sentences of sharp targeting guidance specific to this seller).`,
        JSON.stringify(answers)
      );
      return { data, source: "openai" };
    } catch (err) {
      console.error("[agent-ai] icp generation failed:", err);
    }
  }
  return { data: localIcp(answers), source: "local" };
}

/** Natural-language refinement: "also target Nordic fintechs, drop agencies" → updated criteria. */
export async function refineIcpFromText(
  current: IcpProfile,
  instruction: string,
  orgApiKey?: string | null
): Promise<{ data: IcpDraft; source: "openai" | "local" }> {
  const client = getClient(orgApiKey);
  if (client) {
    try {
      const data = await completeJson<IcpDraft>(
        client,
        `You maintain a B2B Ideal Customer Profile. Apply the user's instruction to the current ICP and return the FULL updated profile as JSON with string keys: industries, regions, companySizes, buyerTitles, signals, exclusions (all comma-separated where lists), aiNotes (update guidance to reflect the change). Keep everything not mentioned by the instruction unchanged.`,
        JSON.stringify({
          current: {
            industries: current.industries,
            regions: current.regions,
            companySizes: current.companySizes,
            buyerTitles: current.buyerTitles,
            signals: current.signals,
            exclusions: current.exclusions,
            aiNotes: current.aiNotes,
          },
          instruction,
        })
      );
      return { data, source: "openai" };
    } catch (err) {
      console.error("[agent-ai] icp refine failed:", err);
    }
  }
  return {
    data: {
      industries: current.industries ?? "",
      regions: current.regions ?? "",
      companySizes: current.companySizes ?? "",
      buyerTitles: current.buyerTitles ?? "",
      signals: current.signals ?? "",
      exclusions: current.exclusions ?? "",
      aiNotes:
        (current.aiNotes ?? "") +
        "\n(Note: natural-language refinement needs an OpenAI key — edit fields directly instead.)",
    },
    source: "local",
  };
}

// ── Account research ───────────────────────────────────────────────────────

export interface ResearchBrief {
  summary: string;
  painHypotheses: string; // newline-separated
  recommendedAngle: string;
  signals: { label: string; detail: string }[];
  confidence: "low" | "medium" | "high";
  sources: string;
}

function localResearch(account: Account, contacts: Prospect[]): ResearchBrief {
  const titles = contacts.map((c) => c.position).filter(Boolean).join(", ");
  return {
    summary: `${account.name} is a ${account.industry ?? "services"} company${account.companySize ? ` (~${account.companySize} employees)` : ""}${account.region ? ` in ${account.region}` : ""}. Known contacts: ${contacts.length || "none yet"}${titles ? ` (${titles})` : ""}.`,
    painHypotheses:
      "Pipeline depends on referrals and founder-led sales\nNo dedicated sales ops — follow-ups slip through the cracks\nHigh-value deals stall without consistent multi-touch outreach",
    recommendedAngle:
      "Lead with time-to-value: consistent qualified meetings without hiring a sales team.",
    signals: [],
    confidence: "low",
    sources: "Your CRM data only (no AI key configured — connect OpenAI for a researched brief)",
  };
}

export async function researchAccount(
  account: Account,
  contacts: Prospect[],
  icp: IcpProfile | null,
  org: Organization,
  orgApiKey?: string | null
): Promise<{ data: ResearchBrief; source: "openai" | "local" }> {
  const client = getClient(orgApiKey);
  if (client) {
    try {
      const data = await completeJson<ResearchBrief>(
        client,
        `You are a B2B sales researcher. Build an account brief for the seller. Be specific and honest about uncertainty: you have NO live web access, so rely on general knowledge of the company/industry plus the CRM facts given. Return JSON: summary (3-4 sentences), painHypotheses (3-4 hypotheses joined by \\n, framed as testable assumptions), recommendedAngle (1-2 sentences: the opening angle for outreach), signals (array of {label, detail} — only include signals you can reasonably infer, empty array if none), confidence ("low"|"medium"|"high" — how confident you are in the company-specific claims), sources (one sentence stating what this is based on, e.g. "Model knowledge up to training cutoff + CRM contacts; verify before outreach").`,
        JSON.stringify({
          seller: { company: org.name, offering: icp?.offering, pitch: org.description },
          account: {
            name: account.name,
            domain: account.domain,
            industry: account.industry,
            companySize: account.companySize,
            region: account.region,
          },
          crmContacts: contacts.map((c) => ({
            name: c.name,
            title: c.position,
            stage: c.stage,
            notes: c.notes,
          })),
          icp: icp
            ? { industries: icp.industries, signals: icp.signals, buyerTitles: icp.buyerTitles }
            : null,
        })
      );
      return { data, source: "openai" };
    } catch (err) {
      console.error("[agent-ai] research failed:", err);
    }
  }
  return { data: localResearch(account, contacts), source: "local" };
}

// ── Explainable scoring ────────────────────────────────────────────────────

export interface ScoreResult {
  fitScore: number;
  intentScore: number;
  rationale: string; // newline-separated "✓/✗ reason" lines
}

/**
 * Deterministic, fully explainable scoring — intentionally NOT an LLM call:
 * fit = ICP criteria matching; intent = real engagement from the CRM.
 */
export function scoreAccount(
  account: Account,
  icp: IcpProfile | null,
  engagement: { sent: number; opened: number; replied: number; meetings: number }
): ScoreResult {
  const reasons: string[] = [];
  let fit = 50;

  const listMatch = (value: string | null, list: string | null, label: string, weight: number) => {
    if (!list || !value) return;
    const items = list.toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
    const hit = items.some((i) => value.toLowerCase().includes(i) || i.includes(value.toLowerCase()));
    fit += hit ? weight : -weight;
    reasons.push(`${hit ? "✓" : "✗"} ${label}: ${value}${hit ? " matches ICP" : " outside ICP"} (${hit ? "+" : "−"}${weight})`);
  };

  listMatch(account.industry, icp?.industries ?? null, "Industry", 15);
  listMatch(account.region, icp?.regions ?? null, "Region", 10);
  listMatch(account.companySize, icp?.companySizes ?? null, "Company size", 15);
  if (!icp) reasons.push("• No ICP defined yet — fit defaults to 50. Complete the ICP Builder.");
  if (account.source === "ai_suggested" && !account.verified) {
    fit -= 10;
    reasons.push("✗ AI-suggested account, not yet verified (−10)");
  }
  const fitScore = Math.max(0, Math.min(100, fit));

  let intent = 0;
  if (engagement.sent > 0) {
    intent += 15;
    reasons.push(`• Outreach started: ${engagement.sent} email(s) sent (+15 intent)`);
  }
  if (engagement.opened > 0) {
    intent += Math.min(25, engagement.opened * 12);
    reasons.push(`• ${engagement.opened} open(s) (+${Math.min(25, engagement.opened * 12)} intent)`);
  }
  if (engagement.replied > 0) {
    intent += Math.min(40, engagement.replied * 30);
    reasons.push(`• ${engagement.replied} repl(ies) (+${Math.min(40, engagement.replied * 30)} intent)`);
  }
  if (engagement.meetings > 0) {
    intent += 20;
    reasons.push(`• Contact in Meeting stage or beyond (+20 intent)`);
  }
  if (intent === 0) reasons.push("• No engagement yet — intent 0 until outreach begins");
  const intentScore = Math.max(0, Math.min(100, intent));

  return { fitScore, intentScore, rationale: reasons.join("\n") };
}
