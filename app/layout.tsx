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
    default: "Selryn — Proposal follow-up for small B2B agencies",
    template: "%s · Selryn",
  },
  description:
    "A lightweight follow-up assistant for small B2B agencies. Selryn reads the email history on your deals, finds the proposals that have gone quiet, says why each one needs you, and drafts the follow-up for you to approve. No CRM to replace, and nothing sends without you.",
  openGraph: {
    title: "Selryn — Proposal follow-up for small B2B agencies",
    description:
      "The demo went well, the proposal went out, and weeks later nobody remembers who owes whom a reply. Selryn finds those deals, says what the records show, and writes the follow-up for you to approve.",
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
