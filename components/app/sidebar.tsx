"use client";

import { useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bot,
  Briefcase,
  Building2,
  CalendarCheck,
  ChevronsUpDown,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Mail,
  Plug,
  Radio,
  Settings,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { Logo } from "@/components/logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { signOut } from "@/app/(marketing)/auth-actions";

interface NavItem {
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
const primaryNav: NavItem[] = [
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { name: "Opportunities", href: "/opportunities", icon: Briefcase },
  { name: "Recover", href: "/recover", icon: LifeBuoy },
  { name: "Signals", href: "/signals", icon: Radio },
  { name: "Conversations", href: "/campaigns", icon: Mail },
  { name: "Meetings", href: "#", icon: CalendarCheck, comingSoon: true },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
];

const workspaceNav: NavItem[] = [
  { name: "Accounts", href: "/accounts", icon: Building2 },
  { name: "Contacts", href: "/prospects", icon: Users },
  { name: "Integrations", href: "/intent", icon: Plug },
  { name: "ICP", href: "/icp", icon: Target },
  { name: "Agent", href: "/agent", icon: Bot },
  { name: "AI Insights", href: "/insights", icon: Sparkles },
  { name: "Settings", href: "/settings", icon: Settings },
];

export interface SidebarUser {
  name: string;
  email: string;
  imageUrl: string | null;
  orgName: string;
}

function NavLink({
  item,
  onNavigate,
  pathname,
}: {
  item: NavItem;
  onNavigate?: () => void;
  pathname: string;
}) {
  if (item.comingSoon) {
    return (
      <span
        aria-disabled
        className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground/50"
      >
        <item.icon className="size-4" />
        {item.name}
        <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
          Soon
        </span>
      </span>
    );
  }

  const active = pathname === item.href || pathname.startsWith(item.href + "/");
  return (
    <Link
      href={item.href}
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

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-4">
      {primaryNav.map((item) => (
        <NavLink
          key={item.name}
          item={item}
          onNavigate={onNavigate}
          pathname={pathname}
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
        />
      ))}
    </nav>
  );
}

export function Sidebar({
  user,
  clerkEnabled,
}: {
  user: SidebarUser;
  clerkEnabled: boolean;
}) {
  const initials =
    user.name
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U";

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border/70 bg-sidebar lg:flex">
      <div className="flex h-16 items-center px-6">
        <Logo href="/dashboard" />
      </div>
      <div className="px-6 pb-4">
        <div className="rounded-lg border border-border/60 bg-background px-3 py-2 text-xs">
          <span className="text-muted-foreground">Workspace</span>
          <div className="mt-0.5 truncate font-medium">{user.orgName}</div>
        </div>
      </div>
      <SidebarNav />
      <div className="border-t border-border/70 p-4">
        {clerkEnabled ? (
          <div className="flex items-center gap-3">
            <UserButton appearance={{ elements: { avatarBox: "size-9" } }} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{user.name}</div>
              <div className="truncate text-xs text-muted-foreground">
                {user.email}
              </div>
            </div>
          </div>
        ) : (
          <LocalUserMenu user={user} initials={initials} />
        )}
      </div>
    </aside>
  );
}

function LocalUserMenu({
  user,
  initials,
}: {
  user: SidebarUser;
  initials: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-lg p-1 text-left transition-colors hover:bg-muted"
          aria-label="Account menu"
          disabled={pending}
        >
          <Avatar className="size-9">
            {user.imageUrl && <AvatarImage src={user.imageUrl} />}
            <AvatarFallback className="bg-accent text-xs font-medium text-accent-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{user.name}</div>
            <div className="truncate text-xs text-muted-foreground">
              {user.email}
            </div>
          </div>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-56">
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings className="size-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => startTransition(() => signOut())}
          disabled={pending}
        >
          <LogOut className="size-4" />
          {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
