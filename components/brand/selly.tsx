"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Selly, the Selryn mascot.
 *
 * ── What exists, and what does not ──
 *
 * Eight poses were supplied, as one sheet. They are cut into square tiles in
 * `public/brand/selly/` and that is the whole vocabulary: every state below
 * maps to a pose that was drawn, and nothing is produced by recolouring,
 * flipping or filtering another one. A mascot whose "surprised" face is its
 * "happy" face with a hue rotation reads as exactly that, and the character
 * stops being a character.
 *
 * The tiles keep the sheet's own lavender background rather than being cut
 * out. The drop shadow under each pose and the character's own purple sit in
 * the same part of colour space, so every automatic matte either ate the
 * shadow's neighbours or left a violet halo — and a halo on a white page is
 * more damaging to a premium impression than an honest tile. Rendered inside
 * a rounded container tinted to the same lavender, the tile reads as a
 * deliberate avatar chip. If transparent PNGs are supplied later they drop
 * into this component unchanged; only `rounded` would stop being wanted.
 *
 * ── Motion ──
 *
 * One idle float, from the existing `anim-float` utility, which globals.css
 * already disables under prefers-reduced-motion. No JavaScript, no
 * dependency, no per-frame work. Blinking and head turns would each need
 * their own frames and are listed in the handover as assets still needed
 * rather than faked here.
 */

export type SellyPose =
  /** Sitting with a laptop. The portrait pose — needs room, 64px and up. */
  | "hero"
  /**
   * Head only, cropped from the portrait.
   *
   * Exists because the full-body pose is unreadable small: at 30px her head
   * is about twelve pixels and the whole thing reads as a lavender smudge,
   * which is worse than no mascot at all. Anything under ~44px should use
   * this.
   */
  | "face"
  /** Magnifying glass — looking for the deal that needs you. */
  | "who"
  /** Hand to chin under a lightbulb — working out why. */
  | "why"
  /** Holding an envelope — the drafted follow-up. */
  | "next"
  /** Sparkles — a small, pleased acknowledgement. */
  | "happy"
  /** Arms up — something actually landed. */
  | "cheer"
  /** Asleep — nothing needs anyone. */
  | "sleep"
  /** Holding a mug — waiting, with nothing to chase. */
  | "mug";

/** Alt text per pose. Describes the character, never the UI state it sits in. */
const ALT: Record<SellyPose, string> = {
  hero: "Selly, the Selryn panda, working at a laptop",
  face: "Selly, the Selryn panda",
  who: "Selly looking through a magnifying glass",
  why: "Selly thinking, with a lightbulb overhead",
  next: "Selly holding an envelope",
  happy: "Selly looking pleased",
  cheer: "Selly cheering with both arms up",
  sleep: "Selly asleep",
  mug: "Selly holding a mug",
};

export function Selly({
  pose,
  size = 56,
  float = false,
  rounded = true,
  className,
  priority = false,
}: {
  pose: SellyPose;
  size?: number;
  /** The idle drift. Off by default — a page of floating things is a toy. */
  float?: boolean;
  rounded?: boolean;
  className?: string;
  priority?: boolean;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden bg-[#EDE5FE]",
        rounded && "rounded-2xl",
        float && "anim-float",
        className
      )}
      style={{ width: size, height: size }}
    >
      <Image
        src={`/brand/selly/selly-${pose}.webp`}
        alt={ALT[pose]}
        // Asked for at twice the rendered size and scaled down by the
        // wrapper. At the natural size the browser kept choosing the 1x
        // candidate on a retina screen — a 30px chip decoding at 32px,
        // which on a page whose whole claim is "premium" is the one defect
        // nobody can miss and everybody attributes to the brand.
        width={size * 2}
        height={size * 2}
        quality={90}
        priority={priority}
        // The tiles are square and already padded, so no object-fit games.
        className="size-full select-none"
        draggable={false}
      />
    </span>
  );
}

/**
 * Selly with a line of text beside her.
 *
 * Exists so the mascot never appears as decoration on its own: wherever she
 * shows up she is saying something about the state of the screen, which is
 * the difference between a character and a sticker.
 */
export function SellySays({
  pose,
  children,
  size = 44,
  float = false,
  className,
}: {
  pose: SellyPose;
  children: React.ReactNode;
  size?: number;
  float?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <Selly pose={pose} size={size} float={float} />
      <span className="min-w-0 text-left">{children}</span>
    </span>
  );
}

/**
 * Selly, walking to whichever tab is active.
 *
 * She measures the live position of the selected tab and slides there, which
 * is the only approach that survives this page: the hero's strip has
 * unequal-width tabs and scrolls horizontally on a phone, so anything based
 * on "one third of the width per tab" drifts out of alignment the moment a
 * label wraps or the strip scrolls. A ResizeObserver re-measures rather than
 * trusting the first paint.
 *
 * The lane is a fixed-height strip of its own so she never overlaps the
 * panel below — a mascot that covers the product is the failure mode this
 * whole placement is trying to avoid.
 */
export function SellyTrail({
  containerRef,
  active,
  poses,
  size = 64,
  className,
}: {
  /** Wraps the tablist. Any `[role="tab"]` inside is a stop on her route. */
  containerRef: React.RefObject<HTMLElement | null>;
  active: number;
  /** One drawn pose per tab, in tab order. */
  poses: SellyPose[];
  size?: number;
  className?: string;
}) {
  const [x, setX] = useState<number | null>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(
      typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }, []);

  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;

    const measure = () => {
      const tabs = host.querySelectorAll<HTMLElement>('[role="tab"]');
      const tab = tabs[active];
      if (!tab) return;
      const hr = host.getBoundingClientRect();
      const tr = tab.getBoundingClientRect();
      setX(tr.left - hr.left + tr.width / 2);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [containerRef, active]);

  // Until the first measurement there is nowhere honest to put her, and a
  // mascot that starts at the left edge and jumps is worse than one that
  // fades in already in place.
  if (x === null) return <div style={{ height: size }} aria-hidden />;

  return (
    <div
      className={cn("pointer-events-none relative", className)}
      style={{ height: size }}
      aria-hidden
    >
      <span
        className="absolute bottom-0 left-0"
        style={{
          transform: `translateX(${Math.round(x)}px) translateX(-50%)`,
          transition: reduced
            ? "none"
            : "transform 620ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <Selly pose={poses[active] ?? poses[0]} size={size} float />
      </span>
    </div>
  );
}
