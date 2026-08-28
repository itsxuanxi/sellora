import Link from "next/link";

export const metadata = {
  title: "Privacy",
  description: "Sellora's privacy policy.",
};

/**
 * An honest placeholder, not fabricated legal text.
 *
 * The footer needs a Privacy destination, but generating plausible-sounding
 * policy language would be worse than a 404: it would be a legal document
 * nobody wrote and nobody reviewed, presented as binding. This page states
 * what is factually true about the product's data handling — each point
 * verifiable in the codebase — and says plainly that the formal policy is
 * still being prepared.
 */
export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-32 md:px-8 md:py-40">
      <h1 className="text-3xl font-medium tracking-tight text-white sm:text-4xl">
        Privacy
      </h1>

      <div className="mt-6 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-5 py-4">
        <p className="text-[15px] leading-relaxed text-amber-100">
          A formal privacy policy is in preparation and has not yet been
          published. Rather than post placeholder legal text, the factual
          statements below describe how Sellora currently handles data. They
          are not a substitute for the policy.
        </p>
      </div>

      <div className="mt-10 space-y-6 text-[15px] leading-relaxed text-neutral-300">
        <section>
          <h2 className="text-lg font-medium text-white">What Sellora stores</h2>
          <p className="mt-2">
            The accounts, contacts, opportunities, email activity and buying
            signals you add or import, plus the scores and recommendations
            derived from them. Each workspace&rsquo;s data is scoped to that
            workspace.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-medium text-white">Model training</h2>
          <p className="mt-2">
            Sellora does not train any model on your data. Scoring is a
            hand-tuned, documented rule set rather than a learned model, so
            there is no training process for your pipeline to feed.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-medium text-white">Third-party services</h2>
          <p className="mt-2">
            Depending on which features you enable, data may be processed by
            the AI provider used for text generation, the email provider used
            for sending, the payment provider used for billing, and the
            database host. The formal policy will name each processor.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-medium text-white">Questions</h2>
          <p className="mt-2">
            Write to{" "}
            <a
              href="mailto:itsxuanxi8@icloud.com"
              className="rounded text-violet-300 underline underline-offset-4 hover:text-violet-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
            >
              itsxuanxi8@icloud.com
            </a>{" "}
            and we will answer directly.
          </p>
        </section>
      </div>

      <Link
        href="/"
        className="mt-12 inline-block rounded text-sm text-neutral-300 underline underline-offset-4 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
      >
        Back to home
      </Link>
    </div>
  );
}
