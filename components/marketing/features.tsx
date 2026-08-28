import {
  Kanban,
  LineChart,
  Mail,
  RefreshCcw,
  Sparkles,
  Target,
} from "lucide-react";

const features = [
  {
    icon: Target,
    title: "Prospect intelligence",
    body: "Build rich prospect profiles — company, role, size, industry, region — and slice your list with instant search and filters.",
  },
  {
    icon: Sparkles,
    title: "1:1 AI personalization",
    body: "GPT writes a cold email, LinkedIn message, icebreaker, and outreach angle for every prospect. You stay in control — edit anything before it sends.",
  },
  {
    icon: Mail,
    title: "Campaigns that send themselves",
    body: "Select prospects, generate the copy, and send through your own domain with Resend. Every open and reply tracked automatically.",
  },
  {
    icon: RefreshCcw,
    title: "Follow-ups on autopilot",
    body: "Three intelligent touches with escalating tones — friendly bump, direct question, graceful breakup — each with a CTA built to get a reply.",
  },
  {
    icon: Kanban,
    title: "Pipeline you can feel",
    body: "A drag-and-drop CRM board from New Lead to Won. Move deals with your cursor; Selryn logs every stage change for you.",
  },
  {
    icon: LineChart,
    title: "Insights that tell you what's next",
    body: "AI reads your outreach data and tells you who's most likely to reply, who's going cold, and why your numbers moved.",
  },
];

export function Features() {
  return (
    <section id="features" className="scroll-mt-20 py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium text-primary">Features</p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-[40px] md:leading-[1.15]">
            Everything a great SDR does. Without hiring one.
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground md:text-lg">
            Selryn runs the whole outbound motion — research, writing,
            sending, following up, and reporting — so you can stay focused on
            closing.
          </p>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-2xl border border-border/70 bg-card p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
            >
              <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <feature.icon className="size-5" />
              </div>
              <h3 className="text-[15px] font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {feature.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
