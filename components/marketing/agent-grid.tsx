"use client";

import { AGENTS, type AgentDef } from "@/lib/agents-data";
import { Reveal } from "@/components/marketing/reveal";

function AgentCard({ agent }: { agent: AgentDef }) {
  return (
    <div
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--mx", `${e.clientX - rect.left}px`);
        e.currentTarget.style.setProperty("--my", `${e.clientY - rect.top}px`);
      }}
      className="group relative flex h-full flex-col overflow-hidden bg-[#0a0b0f] p-7"
    >
      {/* cursor-following spotlight */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(260px circle at var(--mx, 50%) var(--my, 50%), rgba(139,92,246,0.14), transparent 70%)",
        }}
        aria-hidden
      />
      <div className="relative flex items-center justify-between">
        <div className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-violet-300 transition-colors duration-300 group-hover:border-violet-400/40 group-hover:text-violet-200">
          <agent.icon className="size-5" />
        </div>
        <span className="font-mono text-xs text-neutral-600">{agent.n}</span>
      </div>
      <h3 className="relative mt-5 text-lg font-medium tracking-tight text-white">
        {agent.short}
      </h3>
      <p className="relative mt-2.5 text-sm leading-relaxed text-neutral-400">
        {agent.body}
      </p>
    </div>
  );
}

export function AgentGrid() {
  return (
    <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.06] sm:grid-cols-2 lg:grid-cols-3">
      {AGENTS.map((agent, i) => (
        <Reveal key={agent.name} delay={(i % 3) * 80} className="h-full">
          <AgentCard agent={agent} />
        </Reveal>
      ))}
    </div>
  );
}
