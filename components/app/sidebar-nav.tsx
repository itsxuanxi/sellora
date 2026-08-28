"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bot,
  Briefcase,
  Building2,
  CalendarCheck,
  LayoutDashboard,
  LifeBuoy,
  Mail,
  Plug,
  Radio,
  Settings,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

/**
 * The product's navigation and its frame, with nothing authenticated in it.
 *
 * Split out of `sidebar.tsx` so the guided demo can render the real chrome
 * without pulling Clerk or the sign-out action into a public page. The demo
 * passes a `resolve` that redirects the handful of routes it implements and
 * greys out the rest — same markup, same order, same everything a visitor
 * will see the moment they sign in.
 */

export interface NavItem {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  comingSoon?: boolean;
}

/**
 * Navigation follows the revenue loop (§13): the primary group is the path a
 * user walks every morning — see what is leaking, work the queue, act.
 * Everything that supports that loop rather than driving it sits below the
 * divider, so the sidebar reads as one system instead of a feature list.
 */
export const primaryNav: NavItem[] = [
  { name: "Today", href: "/dashboard", icon: LayoutDashboard },
  { name: "Opportunities", href: "/opportunities", icon: Briefcase },
  { name: "Recover", href: "/recover", icon: LifeBuoy },
  { name: "Signals", href: "/signals", icon: Radio },
  { name: "Conversations", href: "/campaigns", icon: Mail },
  { name: "Meetings", href: "#", icon: CalendarCheck, comingSoon: true },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
];

export const workspaceNav: NavItem[] = [
  { name: "Accounts", href: "/accounts", icon: Building2 },
  { name: "Contacts", href: "/prospects", icon: Users },
  { name: "Integrations", href: "/intent", icon: Plug },
  { name: "ICP", href: "/icp", icon: Target },
  { name: "Agent", href: "/agent", icon: Bot },
  { name: "AI Insights", href: "/insights", icon: Sparkles },
  { name: "Settings", href: "/settings", icon: Settings },
];

/** How a surface answers "where does this item go, and is it live here?" */
export type NavResolver = (item: NavItem) => {
  href: string;
  disabled?: boolean;
  active?: boolean;
};

const appResolver: NavResolver = (item) => ({ href: item.href });

function NavLink({
  item,
  onNavigate,
  pathname,
  resolve,
}: {
  item: NavItem;
  onNavigate?: () => void;
  pathname: string;
  resolve: NavResolver;
}) {
  const resolved = resolve(item);
  const disabled = item.comingSoon || resolved.disabled;

  if (disabled) {
    return (
      <span
        aria-disabled
        className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground/50"
      >
        <item.icon className="size-4" />
        {item.name}
        {item.comingSoon && (
          <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
            Soon
          </span>
        )}
      </span>
    );
  }

  const active =
    resolved.active ??
    (pathname === resolved.href || pathname.startsWith(resolved.href + "/"));

  return (
    <Link
      href={resolved.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
        active
          ? "bg-accent font-medium text-accent-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <item.icon className={cn("size-4", active ? "text-primary" : "")} />
      {item.name}
    </Link>
  );
}

export function SidebarNav({
  onNavigate,
  resolve = appResolver,
}: {
  onNavigate?: () => void;
  resolve?: NavResolver;
}) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-4">
      {primaryNav.map((item) => (
        <NavLink
          key={item.name}
          item={item}
          onNavigate={onNavigate}
          pathname={pathname}
          resolve={resolve}
        />
      ))}

      <div className="my-3 border-t border-border/60" />
      <span className="px-3 pb-1 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground/70">
        Workspace
      </span>

      {workspaceNav.map((item) => (
        <NavLink
          key={item.name}
          item={item}
          onNavigate={onNavigate}
          pathname={pathname}
          resolve={resolve}
        />
      ))}
    </nav>
  );
}

/** The fixed rail itself — identical for the live app and the demo. */
export function SidebarShell({
  logoHref,
  workspaceName,
  workspaceNote,
  nav,
  footer,
}: {
  logoHref: string;
  workspaceName: string;
  workspaceNote?: string;
  nav: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border/70 bg-sidebar lg:flex">
      <div className="flex h-16 items-center px-6">
        <Logo href={logoHref} />
      </div>
      <div className="px-6 pb-4">
        <div className="rounded-lg border border-border/60 bg-background px-3 py-2 text-xs">
          <span className="text-muted-foreground">
            {workspaceNote ?? "Workspace"}
          </span>
          <div className="mt-0.5 truncate font-medium">{workspaceName}</div>
        </div>
      </div>
      {nav}
      <div className="border-t border-border/70 p-4">{footer}</div>
    </aside>
  );
}
