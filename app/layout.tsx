import type { Metadata } from "next";
import { Archivo_Narrow, Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "@/components/ui/sonner";
import { isClerkEnabled } from "@/lib/flags";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Brand wordmark — tall, narrow grotesque; used only by the Selryn lockup.
const brandNarrow = Archivo_Narrow({
  variable: "--font-brand",
  subsets: ["latin"],
  weight: ["600"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "Selryn — Know what's blocking your proposals",
    template: "%s · Selryn",
  },
  description:
    "Follow-up for marketing agencies. Selryn reads your proposal threads and CRM, names what is actually blocking each deal, and drafts the next message. Nothing reaches a client without your approval.",
  openGraph: {
    title: "Selryn — Know what's blocking your proposals",
    description:
      "Agencies spend money on leads and hours on proposals, then lose sight of why deals stall. Selryn names the blocker — an unanswered pricing question, an open scope point, a missed follow-up — and drafts the reply for you to approve.",
    siteName: "Selryn",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const page = (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${brandNarrow.variable} font-sans`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );

  return isClerkEnabled ? <ClerkProvider>{page}</ClerkProvider> : page;
}
