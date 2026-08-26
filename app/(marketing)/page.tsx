import { Hero } from "@/components/marketing/home/hero";
import { TrustBar } from "@/components/marketing/home/trust-bar";
import { Problem } from "@/components/marketing/home/problem";
import { Capabilities } from "@/components/marketing/home/capabilities";
import { Workflow } from "@/components/marketing/home/workflow";
import { AskSellora } from "@/components/marketing/home/ask";
import { Solutions } from "@/components/marketing/home/solutions";
import { Control } from "@/components/marketing/home/control";
import { Pricing } from "@/components/marketing/home/pricing";
import { FinalCta } from "@/components/marketing/home/final-cta";
import { getAuthState } from "@/lib/auth";

/**
 * The Sellora home page.
 *
 * Structure follows the buyer's questions in order: what is this (hero) → who
 * is it for and what does it connect to (trust) → why should I care (problem)
 * → how does it work (product, workflow) → show me (demo) → is it for my team
 * (solutions) → can I trust it (control) → what does it cost (pricing) → act.
 *
 * Replaces a 15-section scrollytelling page built on three WebGL scenes. The
 * heaviest of those — a pinned 400vh hero rendering a large glowing orb over a
 * starfield — is gone; its brand role is now filled by a ~4KB 2D canvas signal
 * field that appears twice, at the two ends of the page.
 *
 * The old scrollytelling components are left on disk but no longer imported,
 * so nothing is bundled from them.
 */
export default async function HomePage() {
  const { signedIn } = await getAuthState();
  const startHref = signedIn ? "/dashboard" : "/sign-in";

  return (
    <>
      <Hero startHref={startHref} />
      <TrustBar />
      <Problem />
      <Capabilities />
      <Workflow />
      <AskSellora />
      <Solutions />
      <Control />
      <Pricing startHref={startHref} />
      <FinalCta startHref={startHref} />
    </>
  );
}
