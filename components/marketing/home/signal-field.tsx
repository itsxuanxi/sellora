"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * The one piece of brand motion on the page: a sparse network of signal nodes
 * that occasionally pass a pulse along a connection.
 *
 * Deliberately restrained. It replaces a 259-line three.js scene (a large
 * glowing orb over a starfield) that dominated the viewport and had nothing to
 * do with B2B sales. This is a 2D canvas, no WebGL, no external libraries —
 * roughly 4KB of logic, drawn very faintly behind content so it reads as
 * texture rather than as an illustration competing for attention. On the
 * light surface it is ink-on-warm-white, not glow — the product window must
 * stay the brightest, most contrasted thing on the screen.
 *
 * The metaphor is literal rather than decorative: nodes are accounts, and a
 * pulse travelling an edge is a signal propagating through the pipeline.
 *
 * Fully static under prefers-reduced-motion — it paints one frame and stops.
 */

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

interface Pulse {
  from: number;
  to: number;
  t: number;
  speed: number;
}

const ACCENT = "103, 87, 229"; // --mkt-brand
const INK = "18, 20, 19"; // --mkt-ink, for nodes and links on the light page

export function SignalField({
  className = "",
  density = 0.00006,
}: {
  className?: string;
  /** Nodes per square pixel. Kept low — this is texture, not a graph. */
  density?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduced = prefersReducedMotion();
    let raf = 0;
    let nodes: Node[] = [];
    let pulses: Pulse[] = [];
    let w = 0;
    let h = 0;
    // Cap DPR at 2: beyond that the cost doubles for no visible gain on a
    // background this faint.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const build = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.max(14, Math.min(46, Math.round(w * h * density)));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.08,
        vy: (Math.random() - 0.5) * 0.08,
        r: Math.random() * 1.1 + 0.7,
      }));
      pulses = [];
    };

    const LINK_DIST = 168;

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      // ── edges ──
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.hypot(dx, dy);
          if (dist > LINK_DIST) continue;
          const strength = 1 - dist / LINK_DIST;
          // Very faint ink on warm white — texture, never an illustration.
          ctx.strokeStyle = `rgba(${INK},${strength * 0.07})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }

      // ── nodes ──
      for (const n of nodes) {
        ctx.fillStyle = `rgba(${INK},0.18)`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── pulses: a signal travelling one edge ──
      for (const p of pulses) {
        const a = nodes[p.from];
        const b = nodes[p.to];
        if (!a || !b) continue;
        const x = a.x + (b.x - a.x) * p.t;
        const y = a.y + (b.y - a.y) * p.t;
        // fade in and out across the traverse so nothing pops
        const alpha = Math.sin(p.t * Math.PI) * 0.9;

        const glow = ctx.createRadialGradient(x, y, 0, x, y, 9);
        glow.addColorStop(0, `rgba(${ACCENT},${alpha * 0.28})`);
        glow.addColorStop(1, `rgba(${ACCENT},0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(${ACCENT},${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const spawnPulse = () => {
      if (nodes.length < 2 || pulses.length > 3) return;
      const from = Math.floor(Math.random() * nodes.length);
      // Only fire along an edge that is actually drawn.
      const candidates: number[] = [];
      for (let j = 0; j < nodes.length; j++) {
        if (j === from) continue;
        if (Math.hypot(nodes[from].x - nodes[j].x, nodes[from].y - nodes[j].y) < LINK_DIST) {
          candidates.push(j);
        }
      }
      if (candidates.length === 0) return;
      pulses.push({
        from,
        to: candidates[Math.floor(Math.random() * candidates.length)],
        t: 0,
        speed: 0.004 + Math.random() * 0.004,
      });
    };

    const tick = () => {
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
      }
      for (const p of pulses) p.t += p.speed;
      pulses = pulses.filter((p) => p.t < 1);
      if (Math.random() < 0.012) spawnPulse();

      draw();
      raf = requestAnimationFrame(tick);
    };

    build();

    if (reduced) {
      // One static frame: the texture is present, nothing moves.
      draw();
    } else {
      raf = requestAnimationFrame(tick);
    }

    const onResize = () => {
      build();
      if (reduced) draw();
    };
    window.addEventListener("resize", onResize, { passive: true });

    // Stop burning frames when the tab is hidden.
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
      } else if (!reduced) {
        raf = requestAnimationFrame(tick);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [density]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`pointer-events-none absolute inset-0 size-full ${className}`}
    />
  );
}
