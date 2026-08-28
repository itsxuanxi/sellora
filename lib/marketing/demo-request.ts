import { z } from "zod";

/**
 * The demo request form's shape, shared by the client and the server.
 *
 * One schema, imported by both, is the point: a second copy on the client
 * drifts, and the drift always ends the same way - the form accepts something
 * the server then rejects with an error nobody can act on. The client parse is
 * a courtesy that gives fast feedback; the server parse is the one that
 * decides.
 *
 * Free of `server-only` so the client can import it, and free of any database
 * or mail import so nothing about delivery leaks into the browser bundle.
 */

/**
 * The contact address shown publicly, on the request page and in the success
 * state.
 *
 * Kept separate from where notifications are *delivered* (see
 * demoNotifyEmail() in the server action): the address a visitor is invited to
 * write to and the mailbox that receives form submissions are different
 * decisions, and conflating them means changing one always changes the other.
 *
 * Lives here rather than beside the server action because a "use server" file
 * may only export async functions - exporting a plain const from one silently
 * invalidates *every* export in the module, which typescript does not catch
 * and only shows up when the bundler runs.
 */
export const DEMO_INBOX = "itsxuanxi8@icloud.com";

/** Selects. `value` is stored; `label` is shown. */
export const TEAM_SIZES = [
  { value: "just_me", label: "Just me" },
  { value: "2_5", label: "2-5" },
  { value: "6_20", label: "6-20" },
  { value: "21_50", label: "21-50" },
  { value: "51_plus", label: "51+" },
] as const;

export const CRM_OPTIONS = [
  { value: "hubspot", label: "HubSpot" },
  { value: "salesforce", label: "Salesforce" },
  { value: "pipedrive", label: "Pipedrive" },
  { value: "other", label: "Other" },
  { value: "none", label: "No CRM yet" },
] as const;

export const OPPORTUNITY_VOLUMES = [
  { value: "lt_100", label: "Fewer than 100" },
  { value: "100_500", label: "100-500" },
  { value: "501_2000", label: "501-2,000" },
  { value: "2001_10000", label: "2,001-10,000" },
  { value: "gt_10000", label: "More than 10,000" },
] as const;

const values = <T extends readonly { value: string }[]>(options: T) =>
  options.map((o) => o.value) as [string, ...string[]];

/**
 * Rejects the obvious free mailboxes on a field labelled "Work email".
 *
 * Deliberately a short list of the largest providers rather than an attempt at
 * completeness: the goal is to catch the reflex of typing a personal address,
 * not to police which domain someone is allowed to use. Anything not on the
 * list passes.
 */
const FREE_MAILBOXES = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "qq.com",
  "163.com",
  "126.com",
  "foxmail.com",
]);

export const demoRequestSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Please enter your full name.")
    .max(120, "That name is too long."),

  workEmail: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Work email is required.")
    .email("Enter a valid email address, like you@company.com.")
    .max(200, "That email is too long.")
    .refine(
      (email) => !FREE_MAILBOXES.has(email.split("@")[1] ?? ""),
      "Please use your work email so we can look up your company."
    ),

  company: z
    .string()
    .trim()
    .min(1, "Company is required.")
    .max(160, "That company name is too long."),

  role: z
    .string()
    .trim()
    .min(2, "Role or job title is required.")
    .max(120, "That title is too long."),

  teamSize: z.enum(values(TEAM_SIZES), {
    message: "Select the size of your sales team.",
  }),

  // Optional: someone evaluating Selryn may not have picked a CRM yet, and
  // forcing a choice would make them guess.
  crm: z.enum(values(CRM_OPTIONS)).optional().or(z.literal("")),

  opportunityVolume: z
    .enum(values(OPPORTUNITY_VOLUMES))
    .optional()
    .or(z.literal("")),

  goal: z
    .string()
    .trim()
    .min(10, "Tell us a little about what you want to improve - a sentence is plenty.")
    .max(4000, "Please keep this under 4,000 characters."),

  heardFrom: z.string().trim().max(200).optional().or(z.literal("")),

  /**
   * Honeypot. A real person never sees this field, so anything in it came from
   * a bot filling every input on the page. Named plausibly rather than
   * "honeypot" so it is actually tempting.
   */
  website: z.string().max(0).optional().or(z.literal("")),
});

export type DemoRequestInput = z.input<typeof demoRequestSchema>;

export type DemoRequestValues = z.output<typeof demoRequestSchema>;

/** Field-level errors, keyed by field name, for rendering under each input. */
export type FieldErrors = Partial<Record<keyof DemoRequestInput, string>>;

/** What the server action returns. Also here, for the reason above. */
export type DemoRequestResult =
  | { ok: true }
  | { ok: false; errors?: FieldErrors; formError?: string };

/**
 * Validates and returns per-field messages.
 *
 * Returns the first error per field rather than all of them: showing someone
 * three complaints about one input at once is noise, and they can only fix one
 * at a time anyway.
 */
export function validateDemoRequest(
  input: unknown
): { ok: true; values: DemoRequestValues } | { ok: false; errors: FieldErrors } {
  const parsed = demoRequestSchema.safeParse(input);
  if (parsed.success) return { ok: true, values: parsed.data };

  const errors: FieldErrors = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as keyof DemoRequestInput | undefined;
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return { ok: false, errors };
}

/** Turns a stored value back into its label, for the notification email. */
export function labelFor(
  options: readonly { value: string; label: string }[],
  value: string | null | undefined
): string {
  if (!value) return "Not provided";
  return options.find((o) => o.value === value)?.label ?? value;
}
