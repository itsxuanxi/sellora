import { z } from "zod";
import {
  CAMPAIGN_STATUSES,
  COMPANY_SIZES,
  PIPELINE_STAGES,
  TONES,
} from "@/lib/constants";

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) => v === "" || /^(https?:\/\/)?[\w-]+(\.[\w-]+)+([/?#].*)?$/i.test(v),
    "Enter a valid URL"
  )
  .transform((v) => (v === "" ? null : v.startsWith("http") ? v : `https://${v}`))
  .nullish();

export const prospectSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  company: z.string().trim().min(1, "Company is required").max(120),
  email: z.string().trim().email("Enter a valid email").max(200),
  website: optionalUrl,
  industry: z.string().trim().max(80).nullish(),
  position: z.string().trim().max(120).nullish(),
  linkedin: optionalUrl,
  country: z.string().trim().max(80).nullish(),
  companySize: z.enum(COMPANY_SIZES).nullish(),
  stage: z.enum(PIPELINE_STAGES).default("NEW_LEAD"),
  notes: z.string().trim().max(2000).nullish(),
});

export type ProspectInput = z.infer<typeof prospectSchema>;

export const campaignSchema = z.object({
  name: z.string().trim().min(1, "Campaign name is required").max(120),
  description: z.string().trim().max(1000).nullish(),
  goal: z.string().trim().max(200).nullish(),
  tone: z.enum(TONES).default("professional"),
  status: z.enum(CAMPAIGN_STATUSES).default("DRAFT"),
});

export type CampaignInput = z.infer<typeof campaignSchema>;

export const emailContentSchema = z.object({
  subject: z.string().trim().min(1, "Subject is required").max(200),
  body: z.string().trim().min(1, "Body is required").max(10000),
});

export const profileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
});

export const companySchema = z.object({
  name: z.string().trim().min(1, "Company name is required").max(120),
  website: optionalUrl,
  industry: z.string().trim().max(80).nullish(),
  description: z.string().trim().max(1000).nullish(),
  senderName: z.string().trim().max(120).nullish(),
  senderEmail: z
    .string()
    .trim()
    .max(200)
    .refine((v) => v === "" || z.string().email().safeParse(v).success, {
      message: "Enter a valid email",
    })
    .transform((v) => (v === "" ? null : v))
    .nullish(),
});

export const signUpSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(200),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(200),
});

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(200),
  password: z.string().min(1, "Password is required").max(200),
});

export const apiKeysSchema = z.object({
  openaiApiKey: z.string().trim().max(300).nullish(),
  resendApiKey: z.string().trim().max(300).nullish(),
});
