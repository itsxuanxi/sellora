"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SidebarNav } from "@/components/app/sidebar";

export function MobileNav({ orgName }: { orgName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border/70 bg-background/80 px-4 backdrop-blur-lg lg:hidden">
      <Logo href="/dashboard" />
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Open menu">
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="border-b border-border/70 px-6 py-4">
            <SheetTitle className="text-left">
              <Logo href="/dashboard" />
            </SheetTitle>
            <p className="text-left text-xs text-muted-foreground">{orgName}</p>
          </SheetHeader>
          <div className="py-4">
            <SidebarNav onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
