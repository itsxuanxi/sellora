import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Selryn brand system — monochrome horizontal lockup.
 *
 *   [ S emblem ] │ SELRYN
 *
 * The emblem is an original geometric S: two equal-radius arcs (upper swept
 * counter-clockwise, lower swept clockwise) meeting tangentially at the
 * centre, with flat-cut terminals. Tall and narrow so it sits in proportion
 * with the condensed caps wordmark. No plate, no shield, no gradient.
 *
 * Colour: pure monochrome. Everything inherits `currentColor`, so the mark is
 * near-black (#0A0A0A) on light surfaces and white on dark ones — including
 * inside the `dark` marketing shell.
 *
 * Usage rules:
 *  - Pick a size token; never scale the lockup ad hoc.
 *  - Clear space on all sides = 0.5× the emblem height.
 *  - `LogoMark` (icon-only) is for favicons, avatars, and tight spots.
 */

/** The emblem outline, shared by every rendering surface. */
export const S_PATH =
  "M 21.26 12.32 A 5.6 5.6 0 1 0 16 16 A 5.6 5.6 0 1 1 10.74 23.52";
export const S_STROKE_WIDTH = 3.4;

export const BRAND = {
  ink: "#0A0A0A",
  paper: "#FFFFFF",
} as const;

const MARK_SIZES = {
  sm: "size-5",
  md: "size-6",
  lg: "size-8",
  xl: "size-11",
} as const;

/** emblem px height → rule height, wordmark size, gaps, tracking */
const LOCKUP = {
  sm: { mark: 20, rule: 14, text: 13, gap: 7, tracking: "0.17em" },
  md: { mark: 26, rule: 18, text: 17, gap: 9, tracking: "0.16em" },
  lg: { mark: 34, rule: 24, text: 22, gap: 11, tracking: "0.15em" },
} as const;

/** Icon-only emblem. Inherits `currentColor` unless a colour class is passed. */
export function LogoMark({
  size = "md",
  className,
}: {
  size?: keyof typeof MARK_SIZES;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Selryn"
      className={cn(
        MARK_SIZES[size],
        "shrink-0 text-[#0A0A0A] dark:text-white",
        className
      )}
    >
      <path
        d={S_PATH}
        fill="none"
        stroke="currentColor"
        strokeWidth={S_STROKE_WIDTH}
        strokeLinecap="butt"
      />
    </svg>
  );
}

/** Horizontal lockup: emblem, hairline rule, condensed caps wordmark. */
export function Logo({
  href = "/",
  size = "md",
  onDark = false,
  className,
}: {
  href?: string;
  size?: keyof typeof LOCKUP;
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
      <svg
        viewBox="0 0 32 32"
        xmlns="http://www.w3.org/2000/svg"
        width={s.mark}
        height={s.mark}
        aria-hidden
        className="shrink-0"
      >
        <path
          d={S_PATH}
          fill="none"
          stroke="currentColor"
          strokeWidth={S_STROKE_WIDTH}
          strokeLinecap="butt"
        />
      </svg>
      <span
        aria-hidden
        style={{ height: s.rule }}
        className="w-px shrink-0 bg-current opacity-25"
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
