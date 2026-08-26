import { redirect } from "next/navigation";
import { SignUp } from "@clerk/nextjs";
import { AuthForm } from "@/components/auth/auth-form";
import { getAuthState, isClerkEnabled } from "@/lib/auth";
import { isGoogleEnabled } from "@/lib/google-oauth";

export const metadata = { title: "Start free" };
export const dynamic = "force-dynamic";

export default async function SignUpPage() {
  if (!isClerkEnabled) {
    const { signedIn } = await getAuthState();
    if (signedIn) redirect("/dashboard");
    return (
      <div className="flex min-h-[80svh] items-center justify-center px-5 pb-16 pt-28">
        <AuthForm mode="sign-up" googleEnabled={isGoogleEnabled} />
      </div>
    );
  }

  return (
    <div className="flex min-h-[70svh] items-center justify-center px-5 pt-24 pb-16">
      <SignUp fallbackRedirectUrl="/dashboard" />
    </div>
  );
}
