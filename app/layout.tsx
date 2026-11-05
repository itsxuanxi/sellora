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
    default: "Selryn — Catch deals slipping after demos and proposals",
    template: "%s · Selryn",
  },
  description:
    "Selryn helps small B2B teams catch deals slipping away after demos and proposals, decide the next follow-up, and track what happens. It reads your deals and their email history, shows the evidence behind every alert, and never sends anything without your approval.",
  openGraph: {
    title: "Selryn — Catch deals slipping after demos and proposals",
    description:
      "A demo goes well, the proposal goes out, and weeks later nobody remembers who owes whom a reply. Selryn shows which deals have gone quiet and what the records say about why, tells you who to follow up today, and tracks what came back.",
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
