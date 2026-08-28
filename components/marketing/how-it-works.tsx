const steps = [
  {
    number: "01",
    title: "Add your prospects",
    body: "Import or create the accounts you want to win — founders, growth leads, whoever signs. Selryn enriches each with an AI company summary.",
  },
  {
    number: "02",
    title: "AI writes and sends",
    body: "For every prospect, GPT drafts a personal email, icebreaker, and angle in your voice. Review, tweak if you want, and launch the campaign.",
  },
  {
    number: "03",
    title: "Meetings land on your calendar",
    body: "Selryn follows up three times with escalating tones, tracks every open and reply, and moves deals through your pipeline as they warm up.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-20 border-y border-border/60 bg-muted/30 py-24 md:py-32"
    >
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium text-primary">How it works</p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-[40px] md:leading-[1.15]">
            From cold list to booked calls in three steps
          </h2>
        </div>

        <div className="relative mt-16 grid gap-10 md:grid-cols-3 md:gap-8">
          <div
            className="absolute left-0 right-0 top-6 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block"
            aria-hidden
          />
          {steps.map((step) => (
            <div key={step.number} className="relative">
              <div className="relative z-10 mb-5 flex size-12 items-center justify-center rounded-full border border-primary/25 bg-background font-mono text-sm font-semibold text-primary shadow-sm">
                {step.number}
              </div>
              <h3 className="text-lg font-semibold">{step.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
