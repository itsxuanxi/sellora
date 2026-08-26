"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { KeyRound, MessageSquareText, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { LogoMark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  requestOtp,
  signIn,
  signInToDemo,
  signUp,
  verifyOtp,
} from "@/app/(marketing)/auth-actions";

function DemoButton({ disabled }: { disabled: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      className="w-full gap-2"
      disabled={disabled || pending}
      onClick={() =>
        startTransition(async () => {
          const result = await signInToDemo();
          if (result && !result.ok) toast.error(result.error);
        })
      }
    >
      <Sparkles className="size-4 text-primary" />
      {pending ? "Opening demo…" : "Explore the demo workspace"}
    </Button>
  );
}

function OtpSignIn() {
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [sending, startSend] = useTransition();
  const [verifying, startVerify] = useTransition();

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  function sendCode() {
    startSend(async () => {
      const result = await requestOtp(identifier);
      if (result.ok) {
        setSentTo(identifier);
        setDevCode(result.data.devCode ?? null);
        setCode("");
        setCooldown(60);
        toast.success(
          result.data.channel === "email"
            ? result.data.devCode
              ? "Code generated (dev mode — shown below)"
              : "Code sent — check your inbox"
            : "Code generated (SMS provider not configured — shown below)"
        );
      } else {
        toast.error(result.error);
      }
    });
  }

  function verify(e: React.FormEvent) {
    e.preventDefault();
    startVerify(async () => {
      const result = await verifyOtp(sentTo ?? identifier, code);
      if (result && !result.ok) toast.error(result.error);
    });
  }

  if (!sentTo) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendCode();
        }}
        className="space-y-4"
      >
        <div className="space-y-1.5">
          <Label htmlFor="otp-identifier">Email or phone number</Label>
          <Input
            id="otp-identifier"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="you@company.com or +86 138 0013 8000"
            autoComplete="username"
            required
          />
          <p className="text-xs text-muted-foreground">
            New here? Verifying creates your account automatically.
          </p>
        </div>
        <Button type="submit" className="w-full" disabled={sending}>
          {sending ? "Sending code…" : "Send code"}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={verify} className="space-y-4">
      <div className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
        Code sent to <span className="font-medium text-foreground">{sentTo}</span>{" "}
        <button
          type="button"
          className="ml-1 font-medium text-foreground underline-offset-2 hover:underline"
          onClick={() => {
            setSentTo(null);
            setDevCode(null);
            setCode("");
          }}
        >
          Change
        </button>
      </div>
      {devCode && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Dev mode — your code is{" "}
          <span className="font-mono text-sm font-semibold tracking-widest">
            {devCode}
          </span>
          . Set <code className="font-mono">RESEND_API_KEY</code> (email) or{" "}
          <code className="font-mono">TWILIO_*</code> (SMS) in .env to deliver
          codes for real.
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="otp-code">6-digit code</Label>
        <Input
          id="otp-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="123456"
          inputMode="numeric"
          autoComplete="one-time-code"
          className="text-center font-mono text-lg tracking-[0.5em]"
          required
        />
      </div>
      <Button
        type="submit"
        className="w-full"
        disabled={verifying || code.length !== 6}
      >
        {verifying ? "Verifying…" : "Verify & sign in"}
      </Button>
      <button
        type="button"
        className="w-full text-center text-xs text-muted-foreground disabled:opacity-60"
        onClick={sendCode}
        disabled={cooldown > 0 || sending}
      >
        {cooldown > 0 ? `Resend code in ${cooldown}s` : sending ? "Sending…" : "Resend code"}
      </button>
    </form>
  );
}

function PasswordSignIn() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await signIn(form);
      if (result && !result.ok) toast.error(result.error);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="auth-email">Email</Label>
        <Input
          id="auth-email"
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          placeholder="you@company.com"
          autoComplete="email"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="auth-password">Password</Label>
        <Input
          id="auth-password"
          type="password"
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          placeholder="Your password"
          autoComplete="current-password"
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

function SignUpForm() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await signUp(form);
      if (result && !result.ok) toast.error(result.error);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="auth-name">Full name</Label>
        <Input
          id="auth-name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Alex Carter"
          autoComplete="name"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="auth-email">Email</Label>
        <Input
          id="auth-email"
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          placeholder="you@company.com"
          autoComplete="email"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="auth-password">Password</Label>
        <Input
          id="auth-password"
          type="password"
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          placeholder="At least 8 characters"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}

const AUTH_ERRORS: Record<string, string> = {
  google_state: "Google sign-in expired or was tampered with. Please try again.",
  google_failed: "Google sign-in failed. Please try again.",
  google_disabled: "Google sign-in isn't enabled yet.",
};

function GoogleButton() {
  return (
    <a
      href="/api/auth/google"
      className="flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-border bg-background text-sm font-medium transition-colors hover:bg-muted"
    >
      <svg className="size-4" viewBox="0 0 24 24" aria-hidden>
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 0 0-9.82 6.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
        />
      </svg>
      Continue with Google
    </a>
  );
}

export function AuthForm({
  mode,
  googleEnabled = false,
}: {
  mode: "sign-in" | "sign-up";
  googleEnabled?: boolean;
}) {
  const isSignUp = mode === "sign-up";
  const [method, setMethod] = useState<"otp" | "password">("otp");
  const searchParams = useSearchParams();

  useEffect(() => {
    const error = searchParams.get("error");
    if (error && AUTH_ERRORS[error]) toast.error(AUTH_ERRORS[error]);
  }, [searchParams]);

  return (
    <div className="w-full max-w-md rounded-2xl border border-border/70 bg-card p-8 shadow-sm">
      <div className="mb-6 flex flex-col items-center text-center">
        <LogoMark size="xl" />
        <h1 className="mt-4 text-xl font-semibold tracking-tight">
          {isSignUp ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {isSignUp
            ? "Your AI sales agent is ready in under a minute."
            : "Sign in with a one-time code or your password."}
        </p>
      </div>

      {googleEnabled && (
        <>
          <GoogleButton />
          <div className="my-5 flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">
              or continue with email
            </span>
            <Separator className="flex-1" />
          </div>
        </>
      )}

      {isSignUp ? (
        <SignUpForm />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
            {(
              [
                { value: "otp", label: "Verification code", icon: MessageSquareText },
                { value: "password", label: "Password", icon: KeyRound },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setMethod(option.value)}
                aria-pressed={method === option.value}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                  method === option.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <option.icon className="size-3.5" />
                {option.label}
              </button>
            ))}
          </div>
          {method === "otp" ? <OtpSignIn /> : <PasswordSignIn />}
        </>
      )}

      <div className="my-5 flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">or</span>
        <Separator className="flex-1" />
      </div>

      <DemoButton disabled={false} />

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {isSignUp ? (
          <>
            Already have an account?{" "}
            <Link
              href="/sign-in"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </>
        ) : (
          <>
            Prefer a password account?{" "}
            <Link
              href="/sign-up"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Create one
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
