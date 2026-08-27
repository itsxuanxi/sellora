"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, MessageSquarePlus, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  logAction,
  logOutcome,
  logResponse,
} from "@/app/(app)/opportunities/actions";

/**
 * Human control over the loop's three write points.
 *
 * These exist as explicit, separate dialogs rather than one "update deal"
 * form because the three things are genuinely different claims: what *we*
 * did, what *they* did, and what the deal *became*. Collapsing them would
 * make the resulting data unable to answer the only question the learning
 * layer asks — did the action produce the reaction?
 *
 * Nothing here sends anything. Logging an action records that a human did it;
 * outbound sending stays behind the approval flow in the agent queue.
 */

const ACTION_TYPES = [
  { value: "follow_up", label: "Follow-up" },
  { value: "call", label: "Call" },
  { value: "book_meeting", label: "Book a meeting" },
  { value: "send_case_study", label: "Send a case study" },
  { value: "send_pricing", label: "Send pricing" },
  { value: "send_proposal", label: "Send the proposal" },
  { value: "qualify", label: "Qualification question" },
  { value: "escalate_founder", label: "Founder escalation" },
  { value: "reengage", label: "Re-engage" },
  { value: "note", label: "Note" },
];

const CHANNELS = [
  { value: "email", label: "Email" },
  { value: "call", label: "Call" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "meeting", label: "Meeting" },
  { value: "crm", label: "CRM" },
  { value: "manual", label: "Other" },
];

const RESPONSE_TYPES = [
  { value: "replied", label: "They replied" },
  { value: "meeting_booked", label: "Meeting booked" },
  { value: "proposal_viewed", label: "Proposal viewed" },
  { value: "stakeholder_added", label: "New stakeholder joined" },
  { value: "opportunity_advanced", label: "Deal advanced" },
  { value: "opportunity_regressed", label: "Deal moved backwards" },
  { value: "no_response", label: "No response" },
  { value: "unsubscribed", label: "Unsubscribed" },
];

const OUTCOME_STAGES = [
  { value: "won", label: "Closed won" },
  { value: "lost", label: "Closed lost" },
  { value: "stalled", label: "Stalled" },
  { value: "qualified", label: "Qualified" },
  { value: "meeting_booked", label: "Meeting booked" },
  { value: "reply", label: "Replied" },
];

const LOSS_REASONS = [
  { value: "price", label: "Price" },
  { value: "timing", label: "Timing" },
  { value: "competitor", label: "Lost to a competitor" },
  { value: "no_decision", label: "No decision" },
  { value: "no_budget", label: "No budget" },
  { value: "churn_risk", label: "Churn risk" },
  { value: "other", label: "Other" },
];

export function LoopControls({
  opportunityId,
  recommendationId,
  contactId,
}: {
  opportunityId: string;
  recommendationId?: string | null;
  contactId?: string | null;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <LogActionDialog
        opportunityId={opportunityId}
        recommendationId={recommendationId}
        contactId={contactId}
      />
      <LogResponseDialog opportunityId={opportunityId} contactId={contactId} />
      <LogOutcomeDialog opportunityId={opportunityId} />
    </div>
  );
}

function LogActionDialog({
  opportunityId,
  recommendationId,
  contactId,
}: {
  opportunityId: string;
  recommendationId?: string | null;
  contactId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [actionType, setActionType] = useState("follow_up");
  const [channel, setChannel] = useState("email");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit() {
    if (!summary.trim()) {
      toast.error("Add a one-line summary so the timeline reads properly.");
      return;
    }
    start(async () => {
      const result = await logAction({
        opportunityId,
        recommendationId: recommendationId ?? null,
        contactId: contactId ?? null,
        actionType,
        channel: channel as "email",
        summary: summary.trim(),
        content: content.trim() || null,
      });
      if (result.ok) {
        toast.success("Action logged.");
        setOpen(false);
        setSummary("");
        setContent("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <CheckCheck className="size-4" />
          Log action
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log an action</DialogTitle>
          <DialogDescription>
            Record something you did on this deal. Nothing is sent — this
            writes to the timeline so the recommendation can be measured
            against what happened next.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <Field label="What did you do?">
            <Choose value={actionType} onChange={setActionType} options={ACTION_TYPES} />
          </Field>
          <Field label="Channel">
            <Choose value={channel} onChange={setChannel} options={CHANNELS} />
          </Field>
          <Field label="Summary">
            <Input
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Sent a follow-up referencing their pricing-page visit"
              maxLength={300}
            />
          </Field>
          <Field label="What was said (optional)">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder="Paste the message, or leave blank."
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Saving…" : "Log action"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LogResponseDialog({
  opportunityId,
  contactId,
}: {
  opportunityId: string;
  contactId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [responseType, setResponseType] = useState("replied");
  const [detail, setDetail] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit() {
    start(async () => {
      const result = await logResponse({
        opportunityId,
        contactId: contactId ?? null,
        responseType: responseType as "replied",
        detail: detail.trim() || null,
      });
      if (result.ok) {
        toast.success("Response recorded.");
        setOpen(false);
        setDetail("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <MessageSquarePlus className="size-4" />
          Log response
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>How did they react?</DialogTitle>
          <DialogDescription>
            The customer&apos;s reaction is what turns an action into evidence.
            &quot;No response&quot; is a result worth recording, not a blank.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <Field label="Reaction">
            <Choose value={responseType} onChange={setResponseType} options={RESPONSE_TYPES} />
          </Field>
          <Field label="Detail (optional)">
            <Textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={3}
              placeholder="Asked for security documentation before the next call."
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Saving…" : "Record response"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LogOutcomeDialog({ opportunityId }: { opportunityId: string }) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState("won");
  const [revenue, setRevenue] = useState("");
  const [lossReason, setLossReason] = useState("other");
  const [detail, setDetail] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  const parsedRevenue = Number.parseInt(revenue.replace(/[^0-9]/g, ""), 10);

  function submit() {
    start(async () => {
      const result = await logOutcome({
        opportunityId,
        stage: stage as "won",
        detail: detail.trim() || null,
        revenueAmount:
          stage === "won" && Number.isFinite(parsedRevenue) ? parsedRevenue : null,
        lossReason: stage === "lost" ? (lossReason as "price") : null,
      });
      if (result.ok) {
        toast.success("Outcome recorded.");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Trophy className="size-4" />
          Record outcome
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record the outcome</DialogTitle>
          <DialogDescription>
            Closing the loop. Won and lost also move the opportunity itself, so
            the pipeline and the ledger never disagree.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <Field label="Result">
            <Choose value={stage} onChange={setStage} options={OUTCOME_STAGES} />
          </Field>

          {stage === "won" && (
            <Field label="Revenue booked">
              <Input
                value={revenue}
                onChange={(e) => setRevenue(e.target.value)}
                inputMode="numeric"
                placeholder="Leave blank to use the deal value"
              />
            </Field>
          )}

          {stage === "lost" && (
            <Field label="Why was it lost?">
              <Choose value={lossReason} onChange={setLossReason} options={LOSS_REASONS} />
            </Field>
          )}

          <Field label="Detail (optional)">
            <Textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={3}
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Saving…" : "Record outcome"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function Choose({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
