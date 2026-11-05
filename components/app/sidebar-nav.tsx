"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Briefcase,
  LayoutDashboard,
  Plug,
  Settings,
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

import {
  NAV_DESTINATIONS,
  NAV_SUPPORTING,
  type NavDestination,
} from "@/lib/nav";

export interface NavItem extends NavDestination {
  icon: typeof LayoutDashboard;
}

const ICONS: Record<string, typeof LayoutDashboard> = {
  Today: LayoutDashboard,
  Deals: Briefcase,
  Outcomes: BarChart3,
  Integrations: Plug,
  Settings,
};

const withIcons = (items: NavDestination[]): NavItem[] =>
  items.map((d) => ({ ...d, icon: ICONS[d.name] ?? LayoutDashboard }));

/** The three capabilities. Order and destinations come from lib/nav.ts. */
export const primaryNav: NavItem[] = withIcons(NAV_DESTINATIONS);

/** Infrastructure, below a divider. */
export const supportingNav: NavItem[] = withIcons(NAV_SUPPORTING);

/** Both groups, for anything that needs to resolve any nav href. */
export const allNav: NavItem[] = [...primaryNav, ...supportingNav];

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

  if (resolved.disabled) {
    return (
      <span
        aria-disabled
        className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground/50"
      >
        <item.icon className="size-4" />
        {item.name}
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
      data-tour={`nav-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
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

      {/* Infrastructure sits below a divider rather than alongside the three
          capabilities. Where the data comes from matters enormously and is
          not a thing anyone opens daily; mixing it into the same list made
          the rail read as five equal features. */}
      <div className="my-2 border-t border-border/60" />

      {supportingNav.map((item) => (
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
