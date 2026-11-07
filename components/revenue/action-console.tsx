"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Copy, Loader2, Pencil, Send, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Selly } from "@/components/brand/selly";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  approveAction,
  prepareAction,
  rejectActionAction,
} from "@/app/(app)/opportunities/execution-actions";

/**
 * The approval console: where a recommendation becomes something that happened.
 *
 * One action, editable, with a single primary control — and the destination
 * stated in words above the button, because "Approve" is only meaningful if
 * the person can see what they are approving and where it goes.
 *
 * Rejection asks for a reason. It costs the user a sentence and it is the
 * highest-signal feedback the learning layer ever receives: a recommendation
 * a human refused, with the refusal explained.
 *
 * Three states, each named for where it sits in the sequence — not drafted,
 * drafted and waiting on you, decided. They used to be headed
 * "Human-controlled execution", "Awaiting your approval" and "Action
 * executed", which describe the same three things in three unrelated
 * vocabularies, so nothing told the reader there were three steps or which
 * one they were in.
 */

export interface PreparedAction {
  id: string;
  actionType: string;
  subject: string;
  body: string;
  /** What Selryn wrote, kept beside what was sent. Null on older rows. */
  draftSubject: string | null;
  draftBody: string | null;
  destination: string | null;
  channel: string;
  summary: string;
  status: string;
  simulated: boolean;
  humanEdited: boolean;
  sentAt: string | null;
  decisionReason: string | null;
}

/** Lines present in one version and not the other, counted once. */
function changedLineCount(before: string, after: string): number {
  const b = before.split("\n").map((l) => l.trim()).filter(Boolean);
  const a = after.split("\n").map((l) => l.trim()).filter(Boolean);
  const bSet = new Set(b);
  const aSet = new Set(a);
  const added = a.filter((l) => !bSet.has(l)).length;
  const removed = b.filter((l) => !aSet.has(l)).length;
  return Math.max(added, removed);
}

export interface ActionChoice {
  actionType: string;
  label: string;
  recommended: boolean;
}

export function ActionConsole({
  opportunityId,
  action,
  sandbox,
  executionNote,
  canExecute,
  choices,
  evidenceCount,
  aiConfigured,
}: {
  opportunityId: string;
  /** The PROPOSED action, or the most recent decided one. */
  action: PreparedAction | null;
  sandbox: boolean;
  executionNote: string;
  canExecute: boolean;
  /** The recommended action first, then the always-available alternatives. */
  choices: ActionChoice[];
  /** How many records on this deal the draft was written from. */
  evidenceCount: number;
  /**
   * Whether this workspace has a model configured at all.
   *
   * Without one, drafts come from a local template. A reader is entitled to
   * know which they are looking at before they decide how hard to read it,
   * and a product that lets you assume "AI wrote this" when a template did
   * has spent trust it did not earn.
   */
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [subject, setSubject] = useState(action?.subject ?? "");
  const [body, setBody] = useState(action?.body ?? "");
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const prepare = (actionType?: string) =>
    startTransition(async () => {
      const result = await prepareAction(opportunityId, actionType);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });

  const proposed = action?.status === "PROPOSED";
  const decided = action && !proposed;
  const isEmail = action?.channel === "email";

  // Who wrote the words on screen, said before the reader decides how hard
  // to read them.
  const provenance = aiConfigured
    ? `Selryn's draft${evidenceCount > 0 ? ` · written from ${evidenceCount} record${evidenceCount === 1 ? "" : "s"} on this deal` : ""}`
    : "Written from a template — this workspace has no AI model configured";

  async function copyDraft() {
    const text = isEmail && subject ? `${subject}\n\n${body}` : body;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied.");
    } catch {
      // Clipboard access is refused in some contexts; say so rather than
      // succeeding silently into nothing.
      toast.error("Your browser would not let Selryn copy. Select the text instead.");
    }
  }

  // ── Already decided: show what happened, not another form ──
  if (decided) {
    const sent = action.status === "EXECUTED";
    return (
      <div
        data-tour="action-console"
        className={cn(
          "rounded-2xl border p-5",
          sent ? "border-emerald-500/30 bg-emerald-500/[0.04]" : "border-border/70 bg-muted/20"
        )}
      >
        <div className="flex items-center gap-2">
          {/* Only on a send that happened. A rejection is a decision, not a
              disappointment, and a mascot commiserating about it would be
              the product having an opinion about the seller's judgement. */}
          {sent && <Selly pose="cheer" size={30} float />}
          {sent ? (
            <Check className="size-4 text-emerald-600 dark:text-emerald-400" strokeWidth={3} />
          ) : (
            <X className="size-4 text-muted-foreground" />
          )}
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {sent ? "Step 3 of 3 · Done" : "Step 3 of 3 · Not sent"}
          </span>
          {action.simulated && isEmail && (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">
              Simulated
            </span>
          )}
          {action.humanEdited && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Edited before sending
            </span>
          )}
        </div>

        <p className="mt-2 text-[15px] font-medium">{action.summary}</p>
        {sent && isEmail && action.destination && (
          <p className="mt-1 text-sm text-muted-foreground">
            {action.simulated ? "Would have gone to" : "Sent to"} {action.destination}
          </p>
        )}
        {sent && !isEmail && (
          <p className="mt-1 text-sm text-muted-foreground">
            Recorded on this opportunity. The buyer was not contacted.
          </p>
        )}
        {action.decisionReason && (
          <p className="mt-2 rounded-lg bg-background/60 px-3 py-2 text-sm text-muted-foreground">
            Reason given: {action.decisionReason}
          </p>
        )}

        {/* ── What Selryn wrote, and what you sent ──
               The schema has stored both since the beginning — draftBody
               beside content, with humanEdited as the flag — and nothing
               ever showed it. It is the most convincing thing this product
               can say about its own drafting: not "trust the AI", but here
               is what it proposed, here is what you sent, judge for
               yourself. It is also the only honest basis for ever claiming
               the drafts are good. */}
        {sent && action.draftBody && (
          <div className="mt-3">
            <p className="text-[12.5px] text-muted-foreground">
              {action.humanEdited
                ? `Selryn drafted this · you changed ${changedLineCount(
                    action.draftBody,
                    action.body
                  )} line${
                    changedLineCount(action.draftBody, action.body) === 1 ? "" : "s"
                  } before sending`
                : "Selryn drafted this · you sent it unchanged"}
            </p>
            {action.humanEdited && (
              <details className="group mt-1.5">
                <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-[12.5px] font-medium text-foreground underline decoration-border underline-offset-4 [&::-webkit-details-marker]:hidden">
                  See what you changed
                  <ChevronDown
                    className="size-3 transition-transform group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      Selryn wrote
                    </div>
                    <p className="mt-1 whitespace-pre-wrap rounded-lg bg-background/60 p-2.5 text-[12.5px] leading-relaxed text-muted-foreground">
                      {action.draftBody}
                    </p>
                  </div>
                  <div>
                    <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      You sent
                    </div>
                    <p className="mt-1 whitespace-pre-wrap rounded-lg bg-background/60 p-2.5 text-[12.5px] leading-relaxed">
                      {action.body}
                    </p>
                  </div>
                </div>
              </details>
            )}
          </div>
        )}

        {/* Rejecting one recommendation must not lock the opportunity. The
            deal still needs working, and the rejection is feedback about the
            suggestion rather than a decision to do nothing. */}
        {!sent && canExecute && (
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            disabled={pending}
            onClick={() => prepare()}
          >
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Pencil className="size-3.5" />
            )}
            Draft a different follow-up
          </Button>
        )}
      </div>
    );
  }

  // ── Nothing prepared yet ──
  if (!proposed) {
    return (
      <div
        data-tour="action-console"
        className="rounded-2xl border border-border/70 bg-card p-5"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" />
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Step 1 of 3 · Draft it
          </span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Selryn writes the follow-up from the evidence above. You read and edit
          it (step 2), then approve it (step 3) — nothing reaches the customer
          before that.
        </p>
        <Button className="mt-4" disabled={pending || !canExecute} onClick={() => prepare()}>
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Pencil className="size-3.5" />}
          Draft follow-up
        </Button>

        <ActionPicker
          choices={choices}
          disabled={pending || !canExecute}
          onPick={prepare}
        />
        {!canExecute && (
          <p className="mt-2 text-xs text-muted-foreground">
            Your role can view recommendations but not approve them.
          </p>
        )}
      </div>
    );
  }

  // ── Prepared: review, edit, approve ──
  return (
    <div
      data-tour="action-console"
      className="rounded-2xl border border-primary/25 bg-accent/20 p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-primary">
          Step 2 of 3 · Your review
        </span>
        {sandbox && isEmail && (
          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">
            Simulated send
          </span>
        )}
      </div>

      <p className="mt-2 text-[15px] font-medium">{action!.summary}</p>
      <p className="mt-1 text-[12.5px] text-muted-foreground">{provenance}</p>

      <div className="mt-4 space-y-3">
        {/* A call has no subject line. Presenting one would imply Selryn is
            about to send something it is not. */}
        {isEmail && (
          <div className="space-y-1.5">
            <label htmlFor="action-subject" className="text-xs font-medium text-muted-foreground">
              Subject
            </label>
            <Input
              id="action-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={pending}
            />
          </div>
        )}
        <div className="space-y-1.5">
          <label htmlFor="action-body" className="text-xs font-medium text-muted-foreground">
            {isEmail ? "Message" : "What you plan to say"}
          </label>
          <Textarea
            id="action-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            disabled={pending}
          />
        </div>
      </div>

      <p className="mt-3 text-[13px] text-muted-foreground">{executionNote}</p>

      {/* One solid button on the screen. Copy is for the seller who would
          rather paste this into their own mail client — which, until Selryn
          can send from their mailbox, is a perfectly reasonable preference
          and should not be hidden. */}

      {rejecting ? (
        <div className="mt-4 space-y-2">
          <label htmlFor="reject-reason" className="text-xs font-medium text-muted-foreground">
            Why is this the wrong action? Selryn learns from this.
          </label>
          <Input
            id="reject-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Wrong contact — procurement owns this now"
            disabled={pending}
          />
          <div className="flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              disabled={pending || reason.trim().length === 0}
              onClick={() =>
                startTransition(async () => {
                  const result = await rejectActionAction({
                    actionId: action!.id,
                    reason: reason.trim(),
                  });
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success("Rejected — Selryn will weigh this next time.");
                  router.refresh();
                })
              }
            >
              Confirm rejection
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setRejecting(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            data-tour="approve-send"
            disabled={
              pending ||
              !canExecute ||
              body.trim() === "" ||
              (isEmail && subject.trim() === "")
            }
            onClick={() =>
              startTransition(async () => {
                const result = await approveAction({
                  actionId: action!.id,
                  subject: (isEmail ? subject : action!.summary).trim(),
                  body: body.trim(),
                });
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                toast.success(
                  !isEmail
                    ? "Approved and recorded."
                    : result.data.simulated
                      ? "Approved and recorded — simulated, nothing was delivered."
                      : "Approved and sent."
                );
                router.refresh();
              })
            }
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
            {isEmail ? "Approve and send" : "Approve and log"}
          </Button>
          <Button variant="outline" disabled={pending} onClick={copyDraft}>
            <Copy className="size-3.5" />
            Copy
          </Button>
          {/* A text link, not a third button. Three controls of equal weight
              make the reader choose between them; the rejection is rare and
              only needs to be findable. */}
          <button
            type="button"
            disabled={pending || !canExecute}
            onClick={() => setRejecting(true)}
            className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[13px] text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground disabled:opacity-50"
          >
            <X className="size-3" />
            Not this action
          </button>
        </div>
      )}

      {!rejecting && (
        <ActionPicker
          choices={choices}
          current={action!.actionType}
          disabled={pending || !canExecute}
          onPick={prepare}
        />
      )}
    </div>
  );
}

/**
 * The alternatives, kept deliberately quiet.
 *
 * Selryn's argument is that there is one best next action, so these are a
 * text row under the primary control rather than a grid of equal-weight
 * cards. Choosing one replaces the proposal instead of adding to it — a
 * queue of five drafted actions is the menu this product exists to avoid.
 */
function ActionPicker({
  choices,
  current,
  disabled,
  onPick,
}: {
  choices: ActionChoice[];
  current?: string;
  disabled: boolean;
  onPick: (actionType: string) => void;
}) {
  const others = choices.filter((c) => c.actionType !== current);
  if (others.length === 0) return null;

  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
      <span>Or:</span>
      {others.map((choice, i) => (
        <span key={choice.actionType} className="flex items-center gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onPick(choice.actionType)}
            className="underline decoration-border underline-offset-4 transition-colors hover:text-foreground disabled:opacity-50"
          >
            {choice.label}
          </button>
          {i < others.length - 1 && <span aria-hidden>·</span>}
        </span>
      ))}
    </p>
  );
}
