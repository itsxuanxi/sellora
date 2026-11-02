import "server-only";
import OpenAI from "openai";
import type { AiSource } from "@/lib/ai";
import type { EvidenceRef, FollowUpRule } from "@/lib/followup/rules";

/**
 * Drafting the follow-up.
 *
 * The hard requirement is negative: the draft must not invent anything. A
 * fabricated price, a promise nobody made, a product capability that does not
 * exist — each is worse than no draft, because the seller may not catch it and
 * the customer will. So the model is given the thread and told, in the system
 * prompt and again in the shape of its input, that it has nothing else to work
 * from, and the result is checked before it is offered.
 *
 * Without an OpenAI key this falls back to a plain, honest template. The
 * template says less, which is the right failure: a short accurate note beats
 * a fluent invented one.
 */

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

export interface DraftContext {
  accountName: string;
  contactName: string | null;
  /** Why Selryn surfaced this deal, in the seller's own list. */
  reason: string;
  rule: FollowUpRule;
  /** The real thread, newest first. Subjects and directions only. */
  history: EvidenceRef[];
  /** The seller, for the sign-off. */
  senderName: string | null;
  orgName: string;
  /** Mirrors the customer's language — never translated into English. */
  languageHint: string | null;
}

export interface GeneratedDraft {
  subject: string;
  body: string;
  source: AiSource;
  /** Checks that fired. Shown to the seller rather than silently corrected. */
  warnings: string[];
}

const SYSTEM = `You write short follow-up emails for a B2B salesperson.

Absolute rules, in order of importance:
1. Invent NOTHING. No prices, discounts, dates, deliverables, product
   capabilities, customer names, or commitments that are not in the context
   you are given. If you do not know something, do not mention it.
2. Do not claim anything about what the customer said, needs or promised
   unless it appears in the history provided.
3. Reply in the same language the customer's own messages use.
4. Be brief: two or three sentences. One clear ask at the end.
5. No marketing language, no "just checking in" filler, no exclamation marks.

Return JSON: {"subject": string, "body": string}.
The body is plain text with real line breaks. Do not include a signature
block; the sender's name is appended separately.`;

/** Claims a draft must not make without evidence. */
const FABRICATION_PATTERNS: { pattern: RegExp; warning: string }[] = [
  {
    pattern: /(?:\$|€|£|¥)\s?\d|(?:\d+\s?%\s?(?:discount|off))/i,
    warning: "Mentions a price or discount — check it against what you actually quoted.",
  },
  {
    pattern: /\b(?:I|we)\s+(?:promised|guaranteed|committed)\b/i,
    warning: "Claims a commitment — confirm it was really made.",
  },
  {
    pattern: /\bas (?:we |you )?(?:discussed|agreed)\b/i,
    warning: "Refers to a prior agreement — confirm the thread supports it.",
  },
];

function review(body: string): string[] {
  return FABRICATION_PATTERNS.filter((f) => f.pattern.test(body)).map((f) => f.warning);
}

function historyLines(history: EvidenceRef[]): string {
  if (history.length === 0) return "(no recorded messages)";
  return history
    .slice(0, 12)
    .map((h) => {
      const who = h.kind === "email_inbound" ? "customer" : "us";
      return `- ${h.occurredAt.toISOString().slice(0, 10)} (${who}, ${h.kind}): ${h.summary}`;
    })
    .join("\n");
}

function fallback(ctx: DraftContext): GeneratedDraft {
  const greeting = ctx.contactName ? `Hi ${ctx.contactName.split(/\s+/)[0]},` : "Hello,";
  const lastFromUs = ctx.history.find((h) => h.kind === "email_outbound");
  const subject = lastFromUs?.summary
    ? `Re: ${lastFromUs.summary.replace(/^re:\s*/i, "")}`
    : `Following up — ${ctx.accountName}`;

  // Deliberately says little. Everything here is either the seller's own
  // words from the thread subject, or a question that asserts nothing.
  const ask =
    ctx.rule === "followup_due"
      ? "I said I would come back to you on this — are you still looking at it?"
      : ctx.rule === "quote_no_reply"
        ? "Did you get a chance to look at what I sent?"
        : "Is this still something you are considering?";

  return {
    subject,
    body: `${greeting}\n\n${ask}\n\nHappy to answer anything outstanding.`,
    source: "local",
    warnings: [],
  };
}

export async function generateFollowUpDraft(
  ctx: DraftContext,
  orgApiKey?: string | null
): Promise<GeneratedDraft> {
  const apiKey = orgApiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) return fallback(ctx);

  try {
    const client = new OpenAI({ apiKey });
    const res = await client.chat.completions.create({
      model: MODEL,
      // Low: this is a factual note, and temperature is where invention
      // creeps in.
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            `Company: ${ctx.accountName}`,
            `Contact: ${ctx.contactName ?? "unknown"}`,
            `Sender: ${ctx.senderName ?? ctx.orgName}`,
            ctx.languageHint ? `Customer writes in: ${ctx.languageHint}` : null,
            `Why I am following up: ${ctx.reason}`,
            "",
            "Message history (newest first; subjects only, no bodies available):",
            historyLines(ctx.history),
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    });

    const content = res.choices[0]?.message?.content;
    if (!content) return fallback(ctx);
    const parsed = JSON.parse(content) as { subject?: string; body?: string };
    if (!parsed.subject?.trim() || !parsed.body?.trim()) return fallback(ctx);

    return {
      subject: parsed.subject.trim(),
      body: parsed.body.trim(),
      source: "openai",
      warnings: review(parsed.body),
    };
  } catch {
    // A model outage must not block the seller: they get the plain version
    // and can write their own.
    return fallback(ctx);
  }
}

export { review as reviewDraftForFabrication };
