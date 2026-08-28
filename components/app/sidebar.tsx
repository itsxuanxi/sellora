"use client";

import { useTransition } from "react";
import Link from "next/link";
import { ChevronsUpDown, LogOut, Settings } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarNav, SidebarShell } from "@/components/app/sidebar-nav";
import { signOut } from "@/app/(marketing)/auth-actions";

export { SidebarNav };

export interface SidebarUser {
  name: string;
  email: string;
  imageUrl: string | null;
  orgName: string;
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
    <SidebarShell
      logoHref="/dashboard"
      workspaceName={user.orgName}
      nav={<SidebarNav />}
      footer={
        clerkEnabled ? (
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
        )
      }
    />
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
