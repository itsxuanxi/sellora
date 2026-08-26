import Link from "next/link";
import { Target } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/empty-state";
import { IcpEditor } from "@/components/icp/icp-editor";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = { title: "ICP" };

export default async function IcpPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const [session, params] = await Promise.all([requireSession(), searchParams]);
  const icp = await db.icpProfile.findUnique({ where: { orgId: session.orgId } });

  if (!icp || !icp.completed) {
    return (
      <>
        <PageHeader
          title="Ideal Customer Profile"
          description="Who the agent hunts for — and who it leaves alone."
        />
        <EmptyState
          icon={Target}
          title="No ICP yet"
          description="Answer five questions about what you sell and who buys it — the AI turns that into a structured, editable targeting profile."
        >
          <Button asChild>
            <Link href="/onboarding">Build my ICP</Link>
          </Button>
        </EmptyState>
      </>
    );
  }

  return (
    <>
      {params.welcome && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          🎉 Your ICP is ready — review and adjust it below, then head to{" "}
          <Link href="/accounts" className="font-medium underline underline-offset-2">
            Accounts
          </Link>{" "}
          to add your first targets.
        </div>
      )}
      <PageHeader
        title="Ideal Customer Profile"
        description="Scoring, research, and outreach all follow this profile. Edit fields directly or refine in plain language."
      />
      <IcpEditor icp={icp} />
    </>
  );
}
