import { ImageResponse } from "next/og";

/**
 * Apple touch icon, generated from the brand emblem — no bitmap assets in the
 * repo. Shapes only (no text), so no font loading is required.
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0A0A0A",
        }}
      >
        <svg viewBox="0 0 32 32" width="132" height="132">
          <path
            d="M 21.26 12.32 A 5.6 5.6 0 1 0 16 16 A 5.6 5.6 0 1 1 10.74 23.52"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="3.4"
            strokeLinecap="butt"
          />
        </svg>
      </div>
    ),
    size
  );
}
