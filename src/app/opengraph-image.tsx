import { ImageResponse } from "next/og";
import { site } from "@/lib/site";

export const alt = `${site.name} — ${site.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Rendered at build time: no emoji here, so the build never needs to fetch emoji assets.
export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "linear-gradient(135deg,#067647 0%,#12b76a 100%)", color: "white", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 40, fontWeight: 800 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 26, height: 26, borderRadius: 999, border: "8px solid #12b76a" }} />
          </div>
          nearbygames
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, maxWidth: 900 }}>Find a pickup game near you. Or start one.</div>
          <div style={{ fontSize: 32, marginTop: 24, opacity: 0.9 }}>Football · Cricket · Badminton · Chess · Gaming — every game within a few kilometres, right now.</div>
        </div>
      </div>
    ),
    size,
  );
}
