import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Selryn brand system — the networked S emblem.
 *
 *   [ S emblem ]  SELRYN
 *
 * The emblem is a supplied raster (public/brand/selryn-mark.png, 512px,
 * transparent) rather than the inline SVG that preceded it. Two consequences
 * worth knowing before using it:
 *
 *  - **It carries its own colour.** The old mark inherited `currentColor`, so
 *    it inverted for free on a dark surface. This one is fixed navy and blue
 *    and will disappear against near-black. `onDark` still switches the
 *    wordmark, but there is no dark variant of the emblem; if a dark lockup is
 *    ever needed, a second asset has to be supplied.
 *  - **It has internal detail.** The constellation ring and its dots stop
 *    resolving below roughly 24px, where the mark reads as a blue smudge. The
 *    size tokens below are therefore a notch larger than the previous set, and
 *    the hairline rule that used to divide emblem from wordmark is gone — a
 *    divider beside an intricate circular badge reads as clutter rather than
 *    structure.
 *
 * Usage rules, unchanged: pick a size token, never scale ad hoc; clear space
 * on all sides is 0.5x the emblem height.
 */

const MARK_SRC = "/brand/selryn-mark.png";

/** Icon-only emblem, in px. */
const MARK_SIZES = {
  sm: 24,
  md: 28,
  lg: 36,
  xl: 52,
} as const;

/** emblem px height → wordmark size, gap, tracking */
const LOCKUP = {
  sm: { mark: 24, text: 13, gap: 8, tracking: "0.17em" },
  md: { mark: 30, text: 17, gap: 9, tracking: "0.16em" },
  lg: { mark: 40, text: 22, gap: 11, tracking: "0.15em" },
} as const;

/** Icon-only emblem. */
export function LogoMark({
  size = "md",
  className,
}: {
  size?: keyof typeof MARK_SIZES;
  className?: string;
}) {
  const px = MARK_SIZES[size];
  return (
    <Image
      src={MARK_SRC}
      alt="Selryn"
      width={px}
      height={px}
      className={cn("shrink-0", className)}
      priority
    />
  );
}

/** Horizontal lockup: emblem, then the condensed caps wordmark. */
export function Logo({
  href = "/",
  size = "md",
  onDark = false,
  className,
}: {
  href?: string;
  size?: keyof typeof LOCKUP;
  /** Switches the wordmark only — the emblem has no dark variant. */
  onDark?: boolean;
  className?: string;
}) {
  const s = LOCKUP[size];
  return (
    <Link
      href={href}
      aria-label="Selryn home"
      style={{ gap: s.gap }}
      className={cn(
        "inline-flex items-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-current/40 focus-visible:ring-offset-2",
        onDark ? "text-white" : "text-[#0A0A0A] dark:text-white",
        className
      )}
    >
      {/* Decorative: the link already carries the accessible name, and a second
          "Selryn" here would have a screen reader say it twice. */}
      <Image
        src={MARK_SRC}
        alt=""
        width={s.mark}
        height={s.mark}
        className="shrink-0"
        priority
      />
      <span
        style={{
          fontFamily: "var(--font-brand), 'Arial Narrow', sans-serif",
          fontSize: s.text,
          letterSpacing: s.tracking,
          fontWeight: 600,
          lineHeight: 1,
        }}
        // trailing tracking adds phantom space after the last glyph
        className="-mr-[0.16em] whitespace-nowrap"
      >
        SELRYN
      </span>
    </Link>
  );
}
