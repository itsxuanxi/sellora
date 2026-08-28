import { Hero } from "@/components/marketing/home/hero";
import { Scenarios } from "@/components/marketing/home/scenarios";
import { Pricing } from "@/components/marketing/home/pricing";
import { getAuthState } from "@/lib/auth";

/**
 * The Selryn home page — three screens, one scroll each.
 *
 *   1. Hero      → What is Selryn, and what does it actually do?
 *   2. Scenarios → How does it work, and why should I trust it?
 *   3. Pricing   → What does it cost, and how do I start?
 *
 * This replaces a ten-block page. Problem, Capabilities, Ask Selryn,
 * Solutions, Control and the integrations strip were not deleted so much as
 * absorbed: their content now lives inside the two rotating product demos,
 * where it is demonstrated rather than asserted. The closing CTA moved into
 * the pricing screen.
 *
 * Screens 1 and 2 both auto-rotate, sharing one behaviour hook
 * (useAutoRotate) but rendering completely different layouts — reusing the
 * behaviour without forcing both into the same card shape.
 */
export default async function HomePage() {
  const { signedIn } = await getAuthState();
  const startHref = signedIn ? "/dashboard" : "/sign-in";

  return (
    <>
      <Hero startHref={startHref} />
      <Scenarios />
      <Pricing startHref={startHref} />
    </>
  );
}
