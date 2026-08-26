"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      closeButton
      toastOptions={{
        style: {
          borderRadius: "var(--radius)",
          border: "1px solid var(--border)",
          background: "var(--popover)",
          color: "var(--popover-foreground)",
          boxShadow: "0 8px 30px rgb(0 0 0 / 0.08)",
        },
      }}
    />
  );
}
