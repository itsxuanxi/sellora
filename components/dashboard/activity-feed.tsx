import { formatDistanceToNow } from "date-fns";
import {
  CalendarCheck,
  Mail,
  MailOpen,
  MessageSquareReply,
  Sparkles,
  UserPlus,
  Megaphone,
  ArrowRightLeft,
  type LucideIcon,
} from "lucide-react";
import type { Activity } from "@prisma/client";

const iconByType: Record<string, LucideIcon> = {
  prospect_created: UserPlus,
  email_sent: Mail,
  email_opened: MailOpen,
  email_replied: MessageSquareReply,
  stage_changed: ArrowRightLeft,
  followup_sent: CalendarCheck,
  ai_generated: Sparkles,
  campaign_created: Megaphone,
};

export function ActivityFeed({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) {
    return (
      <p className="px-1 py-8 text-center text-sm text-muted-foreground">
        Activity will appear here as your agent gets to work.
      </p>
    );
  }
  return (
    <ul className="space-y-1">
      {activities.map((activity) => {
        const Icon = iconByType[activity.type] ?? Sparkles;
        return (
          <li
            key={activity.id}
            className="flex items-start gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-muted/60"
          >
            <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent">
              <Icon className="size-3.5 text-accent-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-sm leading-snug">{activity.description}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatDistanceToNow(activity.createdAt, { addSuffix: true })}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
