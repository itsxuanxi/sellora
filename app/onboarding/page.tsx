import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding/wizard";
import { Logo } from "@/components/logo";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = { title: "Set up your agent" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await requireSession();
  const icp = await db.icpProfile.findUnique({ where: { orgId: session.orgId } });
  if (icp?.completed) redirect("/dashboard");

  return (
    <div className="flex min-h-svh flex-col items-center bg-background px-5 py-10">
      <div className="mb-10 flex w-full max-w-xl items-center justify-between">
        <Logo href="/dashboard" />
        <span className="text-xs text-muted-foreground">
          {session.org.name}
        </span>
      </div>
      <div className="flex w-full flex-1 items-start justify-center pt-4">
        <OnboardingWizard />
      </div>
    </div>
  );
}
