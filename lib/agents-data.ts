import {
  BarChart3,
  CalendarCheck,
  Filter,
  MessagesSquare,
  RefreshCw,
  Send,
  type LucideIcon,
} from "lucide-react";

/** Single source of truth for Selryn's six agents — used by the hero chip
 * strip, the capabilities grid, and the "One brain, six agents" scrollytelling
 * section, so the narrative stays consistent everywhere it appears. */
export type AgentDef = {
  n: string;
  icon: LucideIcon;
  name: string;
  short: string;
  body: string;
  /** a concrete, real-time-feeling result this agent just produced */
  result: string;
  /** angle in degrees around the brain core, 0 = due east, clockwise */
  angle: number;
};

export const AGENTS: AgentDef[] = [
  {
    n: "01",
    icon: MessagesSquare,
    name: "Website Chat",
    short: "Website Chat Agent",
    body: "Greets every visitor, answers product questions in real time, and captures intent — day or night.",
    result: "A visitor is asking about pricing.",
    angle: -90,
  },
  {
    n: "02",
    icon: Filter,
    name: "Lead Qualification",
    short: "Lead Qualification Agent",
    body: "Scores and routes leads by fit and intent, so your reps only ever touch the ones worth their time.",
    result: "Intent score increased to 92%.",
    angle: -30,
  },
  {
    n: "03",
    icon: CalendarCheck,
    name: "Meeting Booking",
    short: "Meeting Booking Agent",
    body: "Turns interest into calendar invites — handling timezones, reschedules, and reminders on its own.",
    result: "Demo booked for Thursday at 2:30 PM.",
    angle: 30,
  },
  {
    n: "04",
    icon: Send,
    name: "Follow-up",
    short: "Follow-up Agent",
    body: "Sends timed, personalized follow-ups until a prospect replies or opts out. Never drops a thread.",
    result: "Personalized follow-up sent.",
    angle: 90,
  },
  {
    n: "05",
    icon: RefreshCw,
    name: "CRM Sync",
    short: "CRM Sync Agent",
    body: "Keeps every contact, note, and stage change mirrored in your CRM automatically — zero data entry.",
    result: "Contact and opportunity updated.",
    angle: 150,
  },
  {
    n: "06",
    icon: BarChart3,
    name: "Analytics",
    short: "Analytics Agent",
    body: "Surfaces what's working, who's hot, and where pipeline is leaking, in plain language you can act on.",
    result: "High-intent account identified.",
    angle: 210,
  },
];
