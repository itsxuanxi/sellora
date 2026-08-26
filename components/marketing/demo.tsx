import { Sparkles, Clock, GripVertical } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function Chrome({ children, url }: { children: React.ReactNode; url: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xl shadow-primary/5">
      <div className="flex items-center gap-3 border-b border-border/70 bg-muted/40 px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-rose-300" />
          <span className="size-2.5 rounded-full bg-amber-300" />
          <span className="size-2.5 rounded-full bg-emerald-300" />
        </div>
        <div className="mx-auto flex h-6 w-56 items-center justify-center rounded-md bg-background text-[10px] text-muted-foreground">
          {url}
        </div>
        <div className="w-12" />
      </div>
      <div className="p-5 md:p-6">{children}</div>
    </div>
  );
}

function PersonalizationDemo() {
  return (
    <Chrome url="app.sellora.ai/prospects/maya-lindqvist">
      <div className="grid gap-5 md:grid-cols-[1.5fr_1fr]">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Cold email · editable
            </span>
            <span className="flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
              <Sparkles className="size-3" /> Generated in 2.3s
            </span>
          </div>
          <div className="rounded-xl border border-border/70 bg-background p-4">
            <div className="border-b border-border/60 pb-2 text-xs">
              <span className="text-muted-foreground">Subject: </span>
              <span className="font-medium">
                Nordform&apos;s review queue — a 20-min idea
              </span>
            </div>
            <div className="space-y-2.5 pt-3 text-xs leading-relaxed text-foreground/85">
              <p>Hi Maya,</p>
              <p>
                Saw Nordform just shipped multi-region inference — impressive
                pace for a team of 30.
              </p>
              <p>
                Scaling that fast usually means code review becomes the
                bottleneck. Acme Labs plugs into GitHub and cuts review time
                ~4x without changing your workflow.
              </p>
              <p>Worth a quick 20-minute look next week?</p>
            </div>
          </div>
        </div>
        <div className="space-y-2.5">
          {[
            {
              label: "Icebreaker",
              text: "Multi-region inference launch — congrats, that's a hard problem.",
            },
            {
              label: "Outreach angle",
              text: "Speed of shipping vs. review bottleneck at 30-person scale.",
            },
            {
              label: "Company summary",
              text: "Nordform AI: Swedish ML infra startup, ~30 people, Series A.",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-border/70 bg-background p-3.5"
            >
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                <Sparkles className="size-3" />
                {item.label}
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Chrome>
  );
}

function FollowUpDemo() {
  const followUps = [
    {
      step: "Follow-up 1 · Day 3",
      tone: "Friendly",
      toneClass: "bg-sky-50 text-sky-700",
      text: "Floating this back up — happy to send a 2-line summary instead of a call if that's easier.",
    },
    {
      step: "Follow-up 2 · Day 7",
      tone: "Direct",
      toneClass: "bg-amber-50 text-amber-700",
      text: "One quick question: is review speed a priority for Nordform this quarter? Yes or no is perfect.",
    },
    {
      step: "Follow-up 3 · Day 14",
      tone: "Witty",
      toneClass: "bg-violet-50 text-violet-700",
      text: "I'll take the hint — closing the loop here. If timing changes, my calendar (and dignity) remain open.",
    },
  ];
  return (
    <Chrome url="app.sellora.ai/campaigns/q3-outbound">
      <div className="space-y-3">
        {followUps.map((f) => (
          <div
            key={f.step}
            className="flex items-start gap-4 rounded-xl border border-border/70 bg-background p-4"
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent">
              <Clock className="size-3.5 text-accent-foreground" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium">{f.step}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${f.toneClass}`}
                >
                  {f.tone}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {f.text}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Chrome>
  );
}

function PipelineDemo() {
  const columns = [
    {
      title: "Contacted",
      count: 8,
      cards: [
        { name: "Lucas Meyer", company: "Sequenza" },
        { name: "Yuki Nakamura", company: "Flowdeck" },
      ],
    },
    {
      title: "Interested",
      count: 5,
      cards: [
        { name: "Priya Sharma", company: "Cloudmint", hot: true },
        { name: "Emily Tran", company: "Brightcart" },
      ],
    },
    {
      title: "Meeting",
      count: 3,
      cards: [{ name: "Maya Lindqvist", company: "Nordform AI", hot: true }],
    },
    {
      title: "Won",
      count: 2,
      cards: [{ name: "Anika Rao", company: "Datastride" }],
    },
  ];
  return (
    <Chrome url="app.sellora.ai/pipeline">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {columns.map((col) => (
          <div key={col.title} className="rounded-xl bg-muted/60 p-2.5">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-[11px] font-semibold">{col.title}</span>
              <span className="text-[10px] text-muted-foreground">
                {col.count}
              </span>
            </div>
            <div className="space-y-2">
              {col.cards.map((card) => (
                <div
                  key={card.name}
                  className="flex items-start gap-1.5 rounded-lg border border-border/70 bg-card p-2.5 shadow-sm"
                >
                  <GripVertical className="mt-0.5 size-3 shrink-0 text-muted-foreground/50" />
                  <div className="min-w-0">
                    <div className="truncate text-[11px] font-medium">
                      {card.name}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[10px] text-muted-foreground">
                        {card.company}
                      </span>
                      {card.hot && (
                        <span className="rounded-full bg-rose-50 px-1.5 text-[9px] font-medium text-rose-600">
                          Hot
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Chrome>
  );
}

export function Demo() {
  return (
    <section id="demo" className="scroll-mt-20 py-24 md:py-32">
      <div className="mx-auto max-w-5xl px-5 md:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium text-primary">Product tour</p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-[40px] md:leading-[1.15]">
            See the agent at work
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground md:text-lg">
            Real screens from the product. Every word the AI writes is editable
            before it reaches a prospect.
          </p>
        </div>

        <Tabs defaultValue="personalization" className="mt-12">
          <TabsList className="mx-auto flex h-auto w-fit flex-wrap justify-center gap-1 rounded-full bg-muted p-1">
            <TabsTrigger
              value="personalization"
              className="rounded-full px-4 py-1.5 text-xs data-[state=active]:shadow-sm md:text-sm"
            >
              AI Personalization
            </TabsTrigger>
            <TabsTrigger
              value="followups"
              className="rounded-full px-4 py-1.5 text-xs data-[state=active]:shadow-sm md:text-sm"
            >
              Smart Follow-ups
            </TabsTrigger>
            <TabsTrigger
              value="pipeline"
              className="rounded-full px-4 py-1.5 text-xs data-[state=active]:shadow-sm md:text-sm"
            >
              Pipeline
            </TabsTrigger>
          </TabsList>
          <TabsContent value="personalization" className="mt-8">
            <PersonalizationDemo />
          </TabsContent>
          <TabsContent value="followups" className="mt-8">
            <FollowUpDemo />
          </TabsContent>
          <TabsContent value="pipeline" className="mt-8">
            <PipelineDemo />
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}
