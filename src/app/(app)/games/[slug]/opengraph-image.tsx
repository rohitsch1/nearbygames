import { ImageResponse } from "next/og";
import { formatWhen } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { getGameBySlug } from "@/lib/queries";
import { SPORT_BY_ID } from "@/lib/sports";

export const alt = "Pickup game on nearbygames";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  const sport = game ? SPORT_BY_ID[game.sport] : null;
  const spots = game ? Math.max(game.capacity - game.players_count, 0) : 0;
  const accent = game?.is_paid ? "#f79009" : "#12b76a";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 64, background: "#0b1220", color: "white", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 800 }}>nearby<span style={{ color: "#32d583" }}>games</span></div>
          {game && (
            <div style={{ display: "flex", padding: "10px 24px", borderRadius: 999, background: accent, fontSize: 30, fontWeight: 800 }}>
              {game.is_paid ? `${formatINR(game.fee_paise)} / player` : "Free game"}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
          <div style={{ width: 200, height: 200, borderRadius: 48, background: "#1a2233", border: `6px solid ${accent}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 120 }}>
            {sport?.emoji ?? "📍"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 780 }}>
            <div style={{ fontSize: 30, color: "#98a2b3", fontWeight: 700 }}>{sport?.label ?? "Pickup game"}{game?.city ? ` · ${game.city}` : ""}</div>
            <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.05, marginTop: 8 }}>{game?.spot_name ?? "Game not found"}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 24, fontSize: 32, color: "#e4e7ec" }}>
          {game && <div style={{ display: "flex" }}>🕒 {formatWhen(game.starts_at)}</div>}
          {game && <div style={{ display: "flex" }}>👥 {spots === 0 ? "Full" : `${spots} spot${spots === 1 ? "" : "s"} open`}</div>}
        </div>
      </div>
    ),
    size,
  );
}
