import { CheckCircle2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { BillingPanel } from "@/components/settings/billing-panel";
import {
  ApiKeysForm,
  CompanyForm,
  ProfileForm,
} from "@/components/settings/settings-forms";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isClerkEnabled, requireSession } from "@/lib/auth";
import { isStripeEnabled, type PlanId } from "@/lib/billing";
import { db } from "@/lib/db";

export const metadata = { title: "Settings" };

const TAB_VALUES = ["profile", "company", "api-keys", "billing"];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; checkout?: string }>;
}) {
  const [session, params] = await Promise.all([requireSession(), searchParams]);
  const settings = session.org.settings;
  const org = session.org;
  const activeTab = TAB_VALUES.includes(params.tab ?? "") ? params.tab! : "profile";

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const [prospects, campaigns, emailsSent, followUpsSent] = await Promise.all([
    db.prospect.count({ where: { orgId: org.id } }),
    db.campaign.count({ where: { orgId: org.id } }),
    db.email.count({ where: { orgId: org.id, sentAt: { gte: monthStart } } }),
    db.followUp.count({
      where: { email: { orgId: org.id }, sentAt: { gte: monthStart } },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Settings"
        description="Your profile, company voice, integrations, and billing."
      />

      {params.checkout === "success" && (
        <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="size-4 shrink-0" />
          Payment successful — your plan is being activated. This page updates
          as soon as Stripe confirms (usually seconds).
        </div>
      )}
      {params.checkout === "canceled" && (
        <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <XCircle className="size-4 shrink-0" />
          Checkout canceled — no charge was made.
        </div>
      )}

      <Tabs defaultValue={activeTab} className="gap-6">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileForm
            initialName={session.name ?? ""}
            email={session.email ?? session.phone ?? ""}
            clerkEnabled={isClerkEnabled}
          />
        </TabsContent>

        <TabsContent value="company">
          <CompanyForm
            initial={{
              name: org.name,
              website: org.website ?? "",
              industry: org.industry ?? "",
              description: org.description ?? "",
              senderName: org.senderName ?? "",
              senderEmail: org.senderEmail ?? "",
            }}
          />
        </TabsContent>

        <TabsContent value="api-keys">
          <ApiKeysForm
            hasOpenAi={Boolean(settings?.openaiApiKey)}
            hasResend={Boolean(settings?.resendApiKey)}
            envOpenAi={Boolean(process.env.OPENAI_API_KEY)}
            envResend={Boolean(process.env.RESEND_API_KEY)}
          />
        </TabsContent>

        <TabsContent value="billing">
          <BillingPanel
            state={{
              plan: (org.plan as PlanId) ?? "free",
              planInterval: org.planInterval,
              planStatus: org.planStatus,
              planRenewsAt: org.planRenewsAt?.toISOString() ?? null,
              stripeEnabled: isStripeEnabled,
              simulated: Boolean(org.stripeSubscriptionId?.startsWith("sim_")),
              usage: {
                prospects,
                campaigns,
                emailsThisMonth: emailsSent + followUpsSent,
              },
            }}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}
