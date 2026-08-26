import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-5 text-center">
      <LogoMark size="xl" />
      <h1 className="mt-6 text-4xl font-semibold tracking-tight">
        Page not found
      </h1>
      <p className="mt-3 max-w-sm text-muted-foreground">
        This page doesn&apos;t exist — maybe the prospect ghosted us too.
      </p>
      <div className="mt-7 flex gap-3">
        <Button asChild>
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </div>
  );
}
