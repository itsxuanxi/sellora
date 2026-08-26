import Link from "next/link";

export const metadata = {
  title: "Terms",
  description: "Sellora's terms of service.",
};

/**
 * An honest placeholder, matching app/(marketing)/privacy/page.tsx.
 *
 * Terms of service are a binding contract. Generating them would mean
 * presenting invented obligations as if a lawyer had drafted them, so this
 * page says what is true — they are not ready — and points to a human.
 */
export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-32 md:px-8 md:py-40">
      <h1 className="text-3xl font-medium tracking-tight text-white sm:text-4xl">
        Terms
      </h1>

      <div className="mt-6 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-5 py-4">
        <p className="text-[15px] leading-relaxed text-amber-100">
          Terms of service are in preparation and have not yet been published.
          Terms are a binding agreement, so this page will stay empty until
          real, reviewed terms exist rather than carry placeholder text that
          looks binding but is not.
        </p>
      </div>

      <p className="mt-10 text-[15px] leading-relaxed text-neutral-300">
        If you need terms in place before evaluating or purchasing Sellora,
        contact{" "}
        <a
          href="mailto:hello@sellora.ai?subject=Sellora%20terms"
          className="rounded text-violet-300 underline underline-offset-4 hover:text-violet-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
        >
          hello@sellora.ai
        </a>{" "}
        and we will work through your requirements directly.
      </p>

      <Link
        href="/"
        className="mt-12 inline-block rounded text-sm text-neutral-300 underline underline-offset-4 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
      >
        Back to home
      </Link>
    </div>
  );
}
