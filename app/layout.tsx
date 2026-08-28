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
    default: "Selryn — AI Revenue Intelligence for B2B Sales",
    template: "%s · Selryn",
  },
  description:
    "Find the revenue your sales team is leaving on the table. Selryn detects buying signals, identifies revenue at risk, and tells your team exactly what to do next.",
  openGraph: {
    title: "Selryn — AI Revenue Intelligence for B2B Sales",
    description:
      "Stop losing deals you should have won. Selryn finds the revenue leaking out of your pipeline and prioritizes the opportunities worth your attention.",
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
