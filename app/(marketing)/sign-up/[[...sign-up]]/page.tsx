import { redirect } from "next/navigation";
import { SignUp } from "@clerk/nextjs";
import { AuthForm } from "@/components/auth/auth-form";
import { getAuthState, isClerkEnabled } from "@/lib/auth";
import { isGoogleEnabled } from "@/lib/google-oauth";
import { FREE_PLAN, PLAN_TIERS } from "@/lib/pricing";

export const metadata = { title: "Start free" };
export const dynamic = "force-dynamic";

/**
 * What the chosen plan means here.
 *
 * Pricing sends `?plan=` so the choice is not silently dropped — every button
 * on that screen used to land on one URL that knew nothing about which card
 * had been pressed. Being honest about it means saying two things: we noticed,
 * and you are not being charged yet. Every workspace starts on Free
 * (`Organization.plan` defaults to "free") and a paid plan is set up from
 * Settings afterwards, so a page that said "Starting your Pro trial" would be
 * inventing a flow that does not exist.
 */
function planNote(plan: string | undefined): string | null {
  if (!plan) return null;
  if (plan === "free") {
    return `Free it is — ${FREE_PLAN.summary.replace(/\.$/, "")}. No card needed.`;
  }
  const tier = PLAN_TIERS.find((t) => t.id === plan);
  if (!tier) return null;
  if (tier.customPrice) return null;
  return `You picked ${tier.name}. Your workspace starts on Free with no card — switch to ${tier.name} from Settings once you are in, whenever you are ready.`;
}

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan } = await searchParams;
  const note = planNote(plan);

  const banner = note ? (
    <p className="mx-auto mb-6 max-w-md rounded-xl border border-border/70 bg-muted/30 px-4 py-3 text-center text-[13px] leading-relaxed text-muted-foreground">
      {note}
    </p>
  ) : null;

  if (!isClerkEnabled) {
    const { signedIn } = await getAuthState();
    if (signedIn) redirect("/dashboard");
    return (
      <div className="flex min-h-[80svh] flex-col items-center justify-center px-5 pb-16 pt-28">
        {banner}
        <AuthForm mode="sign-up" googleEnabled={isGoogleEnabled} />
      </div>
    );
  }

  return (
    <div className="flex min-h-[70svh] flex-col items-center justify-center px-5 pb-16 pt-24">
      {banner}
      <SignUp fallbackRedirectUrl="/dashboard" />
    </div>
  );
}
