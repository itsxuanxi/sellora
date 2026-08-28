"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { RotateCcw, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  SidebarNav,
  SidebarShell,
  type NavResolver,
} from "@/components/app/sidebar-nav";
import { useDemo } from "@/components/demo/demo-store";
import { cn } from "@/lib/utils";
import { DEMO_ROUTES } from "@/lib/demo/steps";
import { DEMO_OPPORTUNITY } from "@/lib/demo/fixture";

/**
 * The demo wears the product's own chrome.
 *
 * Same rail, same navigation, same order as a signed-in workspace — the three
 * routes the demo actually implements are live and the rest are greyed out,
 * which is honest about the tour's scope without pretending to be a different
 * piece of software. A visitor who finishes the demo and signs up should
 * recognise the screen they land on, because it is the same screen.
 */

/** /dashboard, /opportunities and /analytics have demo counterparts. */
const demoResolver: NavResolver = (item) => {
  switch (item.href) {
    case "/dashboard":
      return { href: DEMO_ROUTES.workspace };
    case "/opportunities":
      return { href: DEMO_ROUTES.opportunity };
    case "/analytics":
      return { href: DEMO_ROUTES.analytics };
    default:
      return { href: item.href, disabled: true };
  }
};

export function DemoSidebar() {
  const owner = DEMO_OPPORTUNITY.owner;
  const initials = owner
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <SidebarShell
      logoHref={DEMO_ROUTES.workspace}
      workspaceNote="Workspace"
      workspaceName="Northwind Sales"
      nav={<SidebarNav resolve={demoResolver} />}
      footer={
        <div className="flex items-center gap-3">
          <Avatar className="size-9">
            <AvatarFallback className="bg-accent text-xs font-medium text-accent-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{owner}</div>
            <div className="truncate text-xs text-muted-foreground">
              Demo workspace
            </div>
          </div>
        </div>
      }
    />
  );
}

/**
 * The one strip that separates the demo from the real thing: it always says
 * GUIDED DEMO, and it always offers a way out.
 */
export function DemoBar({ bare = false }: { bare?: boolean }) {
  const { restart, exit, stepNumber, totalSteps, isTourActive } = useDemo();
  const router = useRouter();

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
      <div
        className={cn(
          "mx-auto flex items-center gap-3 px-4 py-2.5 md:px-8",
          bare ? "max-w-5xl" : "max-w-6xl"
        )}
      >
        {/* The rail carries the logo on desktop; here it stands in. */}
        <span className={bare ? "" : "lg:hidden"}>
          <Logo size="sm" href={DEMO_ROUTES.intro} />
        </span>
        <span className="rounded-full border border-primary/30 bg-accent px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-accent-foreground">
          Guided demo
        </span>
        {!bare && isTourActive && (
          <span className="hidden text-xs tabular-nums text-muted-foreground sm:inline">
            Step {stepNumber} of {totalSteps}
          </span>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {!bare && (
            <button
              type="button"
              onClick={() => {
                restart();
                router.push(DEMO_ROUTES.workspace);
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/70 px-3 py-1.5 text-[12px] font-medium transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              <span className="hidden sm:inline">Restart</span>
            </button>
          )}
          <Link
            href="/request-demo"
            className="hidden rounded-full border border-border/70 px-3 py-1.5 text-[12px] font-medium transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:inline-block"
          >
            Book a demo
          </Link>
          <button
            type="button"
            onClick={() => {
              exit();
              router.push("/");
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-[12px] font-medium text-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-3.5" aria-hidden />
            <span className="hidden sm:inline">Exit demo</span>
          </button>
        </div>
      </div>
    </header>
  );
}

/** The persistent reminder that none of this is real. */
export function DemoDataBadge({ className }: { className?: string }) {
  return (
    <span
      className={
        className ??
        "inline-block rounded-full border border-border/70 bg-muted/50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground"
      }
    >
      Illustrative demo data
    </span>
  );
}
