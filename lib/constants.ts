export const PIPELINE_STAGES = [
  "NEW_LEAD",
  "CONTACTED",
  "INTERESTED",
  "MEETING",
  "PROPOSAL",
  "WON",
  "LOST",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const STAGE_CONFIG: Record<
  PipelineStage,
  { label: string; dot: string; badge: string }
> = {
  NEW_LEAD: {
    label: "New Lead",
    dot: "bg-slate-400",
    badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
  CONTACTED: {
    label: "Contacted",
    dot: "bg-sky-500",
    badge: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  },
  INTERESTED: {
    label: "Interested",
    dot: "bg-violet-500",
    badge: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  },
  MEETING: {
    label: "Meeting",
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  },
  PROPOSAL: {
    label: "Proposal",
    dot: "bg-orange-500",
    badge: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  },
  WON: {
    label: "Won",
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  },
  LOST: {
    label: "Lost",
    dot: "bg-rose-400",
    badge: "bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-300",
  },
};

export const EMAIL_STATUSES = ["DRAFT", "SENT", "OPENED", "REPLIED"] as const;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];

export const EMAIL_STATUS_CONFIG: Record<
  EmailStatus,
  { label: string; badge: string }
> = {
  DRAFT: {
    label: "Draft",
    badge: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  },
  SENT: {
    label: "Sent",
    badge: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  },
  OPENED: {
    label: "Opened",
    badge: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  },
  REPLIED: {
    label: "Replied",
    badge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  },
};

export const CAMPAIGN_STATUSES = ["DRAFT", "ACTIVE", "COMPLETED"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const TONES = ["professional", "friendly", "direct", "witty"] as const;
export type Tone = (typeof TONES)[number];

export const FOLLOW_UP_TONES: Record<number, Tone> = {
  1: "friendly",
  2: "direct",
  3: "witty",
};

export const COMPANY_SIZES = [
  "1-10",
  "11-50",
  "51-200",
  "201-1000",
  "1000+",
] as const;

export const INDUSTRIES = [
  "AI / Machine Learning",
  "Developer Tools",
  "Fintech",
  "Sales & Marketing",
  "HR & Recruiting",
  "Healthcare",
  "E-commerce",
  "Cybersecurity",
  "Productivity",
  "Data & Analytics",
  "Other",
] as const;

export const INSIGHT_KINDS = ["opportunity", "action", "warning"] as const;
export type InsightKind = (typeof INSIGHT_KINDS)[number];
