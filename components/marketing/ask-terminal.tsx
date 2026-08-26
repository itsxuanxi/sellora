"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

const items = [
  {
    q: "Which leads are most likely to close this week?",
    a: "Ranked 14 leads by intent — top 3: Cloudmint, Brightcart, Ledgerly.",
  },
  {
    q: "Book demos with everyone who viewed pricing twice.",
    a: "Found 6 visitors · 4 demos booked, 2 awaiting a reply.",
  },
  {
    q: "Draft follow-ups for the leads that went quiet.",
    a: "Drafted 9 follow-ups in your voice — ready to review and send.",
  },
  {
    q: "Qualify this new signup and route it to the right rep.",
    a: "Strong fit · 40 seats · active evaluation → routed to Alex.",
  },
  {
    q: "Where did deals stall last month, and why?",
    a: "Most stalls at Proposal — avg 8 days idle. Nudge queued.",
  },
];

type Phase = "typing" | "answer" | "hold";

export function AskTerminal() {
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<Phase>("typing");

  useEffect(() => {
    const current = items[idx];
    let timer: ReturnType<typeof setTimeout>;

    if (phase === "typing") {
      if (typed.length < current.q.length) {
        timer = setTimeout(
          () => setTyped(current.q.slice(0, typed.length + 1)),
          34
        );
      } else {
        timer = setTimeout(() => setPhase("answer"), 450);
      }
    } else if (phase === "answer") {
      timer = setTimeout(() => setPhase("hold"), 2600);
    } else {
      timer = setTimeout(() => {
        setTyped("");
        setPhase("typing");
        setIdx((i) => (i + 1) % items.length);
      }, 400);
    }

    return () => clearTimeout(timer);
  }, [typed, phase, idx]);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a0b0f] shadow-2xl shadow-black/40">
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="ml-2 font-mono text-xs text-neutral-500">
          ask.sellora
        </span>
      </div>
      <div className="min-h-[168px] space-y-4 p-6 font-mono text-sm">
        <div className="flex gap-2.5">
          <span className="text-violet-400/80">&gt;</span>
          <span className="text-neutral-100">
            {typed}
            {phase === "typing" && (
              <span className="anim-caret ml-0.5 inline-block h-4 w-1.5 -translate-y-px bg-violet-400 align-middle" />
            )}
          </span>
        </div>
        <div
          className={`flex gap-2.5 transition-all duration-500 ${
            phase === "typing"
              ? "translate-y-1 opacity-0"
              : "translate-y-0 opacity-100"
          }`}
        >
          <Sparkles className="mt-0.5 size-4 shrink-0 text-violet-400" />
          <span className="leading-relaxed text-neutral-400">
            {items[idx].a}
          </span>
        </div>
      </div>
    </div>
  );
}
