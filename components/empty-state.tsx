import type { LucideIcon } from "lucide-react";
import { Selly, type SellyPose } from "@/components/brand/selly";

/**
 * An empty screen is the one place a mascot earns its keep: there is nothing
 * else on it, and "nothing to do" is a sentence that reads very differently
 * depending on who says it. `selly` opts in per screen — most empty states
 * are a dead end and should stay a plain icon; the ones that mean the work
 * is done get the character.
 */
export function EmptyState({
  icon: Icon,
  selly,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  /** A drawn pose, when this emptiness is worth a character. */
  selly?: SellyPose;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
      {selly ? (
        <div className="mb-4">
          <Selly pose={selly} size={72} float />
        </div>
      ) : (
        <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-accent">
          <Icon className="size-6 text-accent-foreground" />
        </div>
      )}
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}
