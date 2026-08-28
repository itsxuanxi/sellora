import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "Will the emails actually sound like me?",
    a: "Yes. Selryn writes from your company profile — your product, your pitch, your sender name — and every email is fully editable before it sends. Most users tweak the first few, then let the agent run.",
  },
  {
    q: "Do I need my own OpenAI or Resend account?",
    a: "You can bring your own API keys in Settings for full control over costs and deliverability, or use the keys configured by your workspace. Either way, setup takes under two minutes.",
  },
  {
    q: "How do follow-ups work?",
    a: "For every email that doesn't get a reply, Selryn generates a 3-step sequence with escalating tones — a friendly bump, a direct yes/no question, and a graceful breakup. Each step has its own call-to-action strategy, and the sequence stops the moment a prospect replies.",
  },
  {
    q: "Can I import my existing prospect list?",
    a: "You can add prospects individually today, and CSV import is on the near-term roadmap. Each prospect gets an AI company summary, icebreaker, and outreach angle the moment you add them.",
  },
  {
    q: "Is my data used to train AI models?",
    a: "No. Your prospect data and email content are used only to generate your outreach. We never train models on your data, and you can delete your workspace at any time.",
  },
  {
    q: "What happens when a prospect replies?",
    a: "The thread's status flips to Replied, all scheduled follow-ups stop automatically, and the prospect moves forward in your pipeline. AI Insights will flag them as a priority so you can jump in personally.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 py-24 md:py-32">
      <div className="mx-auto max-w-3xl px-5 md:px-8">
        <div className="text-center">
          <p className="text-sm font-medium text-primary">FAQ</p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-[40px] md:leading-[1.15]">
            Questions, answered
          </h2>
        </div>
        <Accordion type="single" collapsible className="mt-12">
          {faqs.map((faq) => (
            <AccordionItem key={faq.q} value={faq.q}>
              <AccordionTrigger className="text-left text-[15px] font-medium hover:no-underline">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
