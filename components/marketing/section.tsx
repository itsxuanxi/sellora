import { Reveal } from "@/components/marketing/reveal";
import { cn } from "@/lib/utils";

/** Shared section header with the big numbered "01 / 02" editorial label. */
export function SectionLabel({
  number,
  label,
}: {
  number: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <span className="font-mono text-sm text-[var(--mkt-brand-deep)]">{number}</span>
      <span className="h-px w-8 bg-[var(--mkt-line)]" />
      <span className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--mkt-muted)]">
        {label}
      </span>
    </div>
  );
}

export function Section({
  id,
  className,
  children,
  ref,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
  /** React 19 passes `ref` as an ordinary prop — used by sections that need
   * to observe their own visibility. */
  ref?: React.Ref<HTMLDivElement>;
}) {
  return (
    <section
      id={id}
      className={cn(
        "relative scroll-mt-24 border-t border-[var(--mkt-line)] px-5 py-20 md:px-8 md:py-24",
        className
      )}
    >
      <div ref={ref} className="mx-auto max-w-6xl">
        {children}
      </div>
    </section>
  );
}

export { Reveal };
