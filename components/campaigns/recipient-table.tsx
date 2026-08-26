"use client";

import { useState, useTransition } from "react";
import {
  Clock,
  MailOpen,
  MessageSquareReply,
  MoreHorizontal,
  PenLine,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { Email, FollowUp, Prospect } from "@prisma/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmailSheet } from "@/components/campaigns/email-sheet";
import { FollowUpsSheet } from "@/components/campaigns/followups-sheet";
import { EMAIL_STATUS_CONFIG, type EmailStatus } from "@/lib/constants";
import {
  generateAllEmails,
  generateEmailForRecipient,
  markEmailStatus,
  removeEmailFromCampaign,
  sendAllEmails,
  sendCampaignEmail,
} from "@/app/(app)/campaigns/actions";

export type RecipientEmail = Email & {
  prospect: Prospect;
  followUps: FollowUp[];
};

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

function RowActions({
  email,
  onEdit,
  onFollowUps,
}: {
  email: RecipientEmail;
  onEdit: () => void;
  onFollowUps: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const isDraft = email.status === "DRAFT";
  const hasContent = Boolean(email.subject.trim());

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(success);
      else toast.error(result.error ?? "Something went wrong.");
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          disabled={pending}
          aria-label={`Actions for ${email.prospect.name}`}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>
          <PenLine className="size-4" />
          {isDraft ? "Edit & send" : "View email"}
        </DropdownMenuItem>
        {isDraft && (
          <DropdownMenuItem
            onClick={() =>
              run(
                () => generateEmailForRecipient(email.id),
                `Email generated for ${email.prospect.name}`
              )
            }
          >
            <Sparkles className="size-4" />
            {hasContent ? "Regenerate with AI" : "Generate with AI"}
          </DropdownMenuItem>
        )}
        {isDraft && hasContent && (
          <DropdownMenuItem
            onClick={() =>
              run(
                () => sendCampaignEmail(email.id),
                `Email sent to ${email.prospect.name}`
              )
            }
          >
            <Send className="size-4" />
            Send now
          </DropdownMenuItem>
        )}
        {!isDraft && (
          <>
            <DropdownMenuItem onClick={onFollowUps}>
              <Clock className="size-4" />
              Follow-ups
              {email.followUps.length > 0 && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {email.followUps.filter((f) => f.status === "SENT").length}/
                  {email.followUps.length} sent
                </span>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {email.status === "SENT" && (
              <DropdownMenuItem
                onClick={() =>
                  run(
                    () => markEmailStatus(email.id, "OPENED"),
                    "Marked as opened"
                  )
                }
              >
                <MailOpen className="size-4" />
                Mark opened
              </DropdownMenuItem>
            )}
            {email.status !== "REPLIED" && (
              <DropdownMenuItem
                onClick={() =>
                  run(
                    () => markEmailStatus(email.id, "REPLIED"),
                    "Marked as replied — follow-ups stopped"
                  )
                }
              >
                <MessageSquareReply className="size-4" />
                Mark replied
              </DropdownMenuItem>
            )}
          </>
        )}
        {isDraft && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() =>
                run(
                  () => removeEmailFromCampaign(email.id),
                  "Removed from campaign"
                )
              }
            >
              <Trash2 className="size-4" />
              Remove from campaign
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function RecipientTable({
  campaignId,
  emails,
}: {
  campaignId: string;
  emails: RecipientEmail[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [followUpsId, setFollowUpsId] = useState<string | null>(null);
  const [bulkGenerating, startBulkGenerate] = useTransition();
  const [bulkSending, startBulkSend] = useTransition();

  const ungenerated = emails.filter(
    (e) => e.status === "DRAFT" && !e.subject.trim()
  ).length;
  const readyToSend = emails.filter(
    (e) => e.status === "DRAFT" && e.subject.trim()
  ).length;

  const editing = emails.find((e) => e.id === editingId) ?? null;
  const followUpsEmail = emails.find((e) => e.id === followUpsId) ?? null;

  function bulkGenerate() {
    startBulkGenerate(async () => {
      const result = await generateAllEmails(campaignId);
      if (result.ok) {
        toast.success(
          `${result.data.generated} email${result.data.generated === 1 ? "" : "s"} generated`,
          {
            description:
              result.data.source === "openai"
                ? "Each one personalized by GPT."
                : "Generated locally — add an OpenAI key in Settings for GPT copy.",
          }
        );
      } else {
        toast.error(result.error);
      }
    });
  }

  function bulkSend() {
    startBulkSend(async () => {
      const result = await sendAllEmails(campaignId);
      if (result.ok) {
        toast.success(
          result.data.simulated
            ? `${result.data.sent} send${result.data.sent === 1 ? "" : "s"} simulated (no Resend key)`
            : `${result.data.sent} email${result.data.sent === 1 ? "" : "s"} sent`
        );
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <>
      {(ungenerated > 0 || readyToSend > 0) && (
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          {ungenerated > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={bulkGenerate}
              disabled={bulkGenerating}
              className="gap-1.5"
            >
              <Sparkles
                className={`size-3.5 ${bulkGenerating ? "animate-pulse" : ""}`}
              />
              {bulkGenerating
                ? "Generating…"
                : `Generate all (${ungenerated})`}
            </Button>
          )}
          {readyToSend > 0 && (
            <Button
              size="sm"
              onClick={bulkSend}
              disabled={bulkSending}
              className="gap-1.5"
            >
              <Send className="size-3.5" />
              {bulkSending ? "Sending…" : `Send all drafts (${readyToSend})`}
            </Button>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">Prospect</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="max-md:hidden">Follow-ups</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {emails.map((email) => {
              const status =
                EMAIL_STATUS_CONFIG[email.status as EmailStatus] ??
                EMAIL_STATUS_CONFIG.DRAFT;
              const sentFollowUps = email.followUps.filter(
                (f) => f.status === "SENT"
              ).length;
              return (
                <TableRow
                  key={email.id}
                  className="cursor-pointer"
                  onClick={() => setEditingId(email.id)}
                >
                  <TableCell className="pl-5">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarFallback className="bg-accent text-[11px] font-medium text-accent-foreground">
                          {initials(email.prospect.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{email.prospect.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {email.prospect.company}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-64">
                    {email.subject ? (
                      <span className="line-clamp-1 text-sm">{email.subject}</span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-sm italic text-muted-foreground">
                        <Sparkles className="size-3.5" />
                        Not generated yet
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={`font-normal ${status.badge}`}
                    >
                      {status.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-md:hidden">
                    {email.status === "DRAFT"
                      ? "—"
                      : email.followUps.length === 0
                        ? "None yet"
                        : `${sentFollowUps}/${email.followUps.length} sent`}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <RowActions
                      email={email}
                      onEdit={() => setEditingId(email.id)}
                      onFollowUps={() => setFollowUpsId(email.id)}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {editing && <EmailSheet email={editing} onClose={() => setEditingId(null)} />}
      {followUpsEmail && (
        <FollowUpsSheet
          email={followUpsEmail}
          onClose={() => setFollowUpsId(null)}
        />
      )}
    </>
  );
}
