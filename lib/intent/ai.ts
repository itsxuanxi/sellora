import "server-only";
import OpenAI from "openai";
import type { Account, Organization, Prospect } from "@prisma/client";
import type { AiSource } from "@/lib/ai";
import { SIGNAL_LABELS, type SignalType } from "@/lib/intent/config";
import { withRetry } from "@/lib/intent/retry";

/**
 * AI for the Buying-Intent engine. Same philosophy as lib/ai.ts and
 * lib/agent-ai.ts: GPT when a key exists, deterministic fallback otherwise.
 *
 * The hard rule here is stricter than elsewhere in the app: if there is no
 * verified evidence (`signals.length === 0`), the model is never called at
 * all — we return "Insufficient evidence" straight from code. That's a
 * structural guarantee, not a prompt instruction the model could ignore.
 */

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

function getClient(orgApiKey?: string | null): OpenAI | null {
  const apiKey = orgApiKey || process.env.OPENAI_API_KEY;
  return apiKey ? new OpenAI({ apiKey }) : null;
}

async function completeJson<T>(client: OpenAI, system: string, user: string): Promise<T> {
  return withRetry(
    async () => {
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
    },
    { attempts: 3, baseDelayMs: 400, label: "intent-ai completion" }
  );
}

export interface EvidenceItem {
  signalType: SignalType | string;
  title: string;
  evidence: string | null;
  occurredAt: string; // ISO
  confidence: string;
  isMockData: boolean;
}

export interface IntentBrief {
  accountSummary: string;
  recommendedAngle: string;
  subject: string;
  body: string;
  insufficientEvidence: boolean;
}

const INSUFFICIENT_EVIDENCE_BRIEF: IntentBrief = {
  accountSummary: "Insufficient evidence — no verified buying signals recorded for this company yet.",
  recommendedAngle: "Insufficient evidence.",
  subject: "",
  body: "",
  insufficientEvidence: true,
};

function localIntentBrief(
  account: Account,
  contact: Prospect | null,
  org: Organization,
  evidence: EvidenceItem[],
  cta: string | null
): IntentBrief {
  const top = evidence[0];
  const label = SIGNAL_LABELS[top.signalType as SignalType] ?? top.signalType;
  const fn = contact ? contact.name.trim().split(/\s+/)[0] : "there";
  const evidenceLine = evidence
    .slice(0, 3)
    .map((e) => `- ${SIGNAL_LABELS[e.signalType as SignalType] ?? e.signalType}${e.evidence ? `: ${e.evidence}` : ""}`)
    .join("\n");

  return {
    accountSummary: `${account.name} shows ${evidence.length} recorded buying signal(s), most recently "${label}"${top.evidence ? ` (${top.evidence})` : ""}.`,
    recommendedAngle: `Open with the ${label.toLowerCase()} signal directly — it's the most concrete, verifiable reason to reach out right now.`,
    subject: `Noticed ${account.name} is ${label.toLowerCase()}`,
    body: `Hi ${fn},\n\nNoticed a few things about ${account.name} recently:\n${evidenceLine}\n\n${org.description?.trim() || `${org.name} helps recruiting teams turn hiring signals into staffed roles faster`}.\n\n${cta || "Worth a quick 15-minute call this week?"}\n\nBest,\n${org.senderName ?? "The " + org.name + " team"}`,
    insufficientEvidence: false,
  };
}

export async function generateIntentBrief(
  account: Account,
  contact: Prospect | null,
  org: Organization,
  evidence: EvidenceItem[],
  cta: string | null,
  tone: string,
  orgApiKey?: string | null
): Promise<{ data: IntentBrief; source: AiSource }> {
  // Structural guarantee against hallucination: no evidence ⇒ no AI call.
  if (evidence.length === 0) {
    return { data: INSUFFICIENT_EVIDENCE_BRIEF, source: "local" };
  }

  const client = getClient(orgApiKey);
  if (client) {
    try {
      const data = await completeJson<IntentBrief>(
        client,
        `You are a B2B sales researcher and copywriter writing for a recruiting-industry seller. You will be given a list of VERIFIED buying signals for a target company and must ground every claim in them — do not invent company events, funded amounts, contact identities, job postings, or product capabilities beyond what is given. If a claim in the "evidence" array is marked isMockData: true, treat it as illustrative demo data, not fact, and hedge language accordingly (e.g. "may be" instead of "is"). Tone: ${tone}. Return JSON with keys: accountSummary (2-3 sentences, cites the evidence), recommendedAngle (1-2 sentences), subject (email subject line), body (email body, plain text, \\n\\n paragraph breaks, under 130 words, ends with the sender signature, references at least one concrete signal), insufficientEvidence (boolean — set true and leave subject/body empty ONLY if you genuinely cannot ground an email in the given evidence).`,
        JSON.stringify({
          seller: { company: org.name, pitch: org.description, senderName: org.senderName },
          account: {
            name: account.name,
            industry: account.industry,
            companySize: account.companySize,
            region: account.region,
          },
          contact: contact
            ? { name: contact.name, title: contact.position }
            : null,
          evidence,
          cta,
        })
      );
      return { data, source: "openai" };
    } catch (err) {
      console.error("[intent-ai] brief generation failed, using local fallback:", err);
    }
  }
  return { data: localIntentBrief(account, contact, org, evidence, cta), source: "local" };
}

// ── Reply intent classification ────────────────────────────────────────────

export type ReplyIntent =
  | "interested"
  | "not_interested"
  | "objection"
  | "out_of_office"
  | "unsubscribe"
  | "unclear";

function localClassifyReply(text: string): ReplyIntent {
  const t = text.toLowerCase();
  if (/unsubscribe|remove me|stop emailing/.test(t)) return "unsubscribe";
  if (/out of office|ooo|on vacation|on leave/.test(t)) return "out_of_office";
  if (/not interested|no thanks|please stop|not a priority right now/.test(t)) return "not_interested";
  if (/interested|let's talk|book a (call|time|meeting)|sounds good|sure,? (let's|when)/.test(t)) return "interested";
  if (/budget|already have|already working with|too expensive/.test(t)) return "objection";
  return "unclear";
}

export async function classifyReplyIntent(
  text: string,
  orgApiKey?: string | null
): Promise<{ data: ReplyIntent; source: AiSource }> {
  const client = getClient(orgApiKey);
  if (client) {
    try {
      const parsed = await completeJson<{ intent: ReplyIntent }>(
        client,
        `Classify the intent of this cold-email reply into exactly one of: interested, not_interested, objection, out_of_office, unsubscribe, unclear. Return JSON: {"intent": "..."}.`,
        text
      );
      if (parsed.intent) return { data: parsed.intent, source: "openai" };
    } catch (err) {
      console.error("[intent-ai] reply classification failed:", err);
    }
  }
  return { data: localClassifyReply(text), source: "local" };
}
