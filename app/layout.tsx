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
    default: "Selryn — Know exactly who to contact next",
    template: "%s · Selryn",
  },
  description:
    "Selryn finds the sales opportunities your team is about to lose, explains why they matter, and recommends the next action. Nothing reaches a customer without your approval.",
  openGraph: {
    title: "Selryn — Know exactly who to contact next",
    description:
      "Warm deals go quiet and nobody notices. Selryn watches the pipeline you already have, surfaces the opportunities at risk, and drafts the follow-up for you to approve.",
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
