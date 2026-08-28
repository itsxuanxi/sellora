import { redirect } from "next/navigation";
import { MobileNav } from "@/components/app/mobile-nav";
import { SampleDataBar } from "@/components/app/sample-data-bar";
import { OnboardingDialog } from "@/components/app/onboarding-dialog";
import { Sidebar } from "@/components/app/sidebar";
import { isClerkEnabled, requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

// Every app page renders live workspace data; never prerender at build time.
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const needsOnboarding = !session.name;

  // Fresh workspaces (no ICP, no data yet) start with the business
  // onboarding wizard — existing workspaces are never interrupted, and a
  // sandbox arrives pre-seeded so it never sees onboarding at all.
  const [icp, prospectCount] = await Promise.all([
    db.icpProfile.findUnique({ where: { orgId: session.orgId }, select: { id: true } }),
    db.prospect.count({ where: { orgId: session.orgId } }),
  ]);
  if (!session.org.isSample && !icp && prospectCount === 0) redirect("/onboarding");

  // Any workspace holding sample rows discloses it on every screen.
  const showSampleBar =
    session.org.isSample || session.org.sampleSeededAt !== null;

  return (
    <div className="min-h-svh bg-background">
      <Sidebar
        clerkEnabled={isClerkEnabled}
        user={{
          name: session.name ?? "You",
          email: session.email ?? session.phone ?? "",
          imageUrl: session.imageUrl,
          orgName: session.org.name,
        }}
      />
      <MobileNav orgName={session.org.name} />
      <main className="lg:pl-60">
        {showSampleBar && (
          <SampleDataBar
            sandbox={session.org.isSample}
            hasSampleData={session.org.sampleSeededAt !== null}
          />
        )}
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10">
          {children}
        </div>
      </main>
      {needsOnboarding && (
        <OnboardingDialog defaultWorkspaceName={session.org.name} />
      )}
    </div>
  );
}
