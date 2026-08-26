import { MarketingNavbar } from "@/components/marketing/navbar";
import { MarketingFooter } from "@/components/marketing/footer";
import { SmoothScroll } from "@/components/marketing/smooth-scroll";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dark isolate min-h-svh bg-[#09090B] font-sans text-white antialiased selection:bg-violet-500/30 selection:text-white">
      <div
        className="pointer-events-none fixed inset-0 -z-50 bg-[#09090B]"
        aria-hidden
      />
      <SmoothScroll />
      <MarketingNavbar />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
