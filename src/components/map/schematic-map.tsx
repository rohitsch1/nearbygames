"use client";

import { clsx } from "clsx";
import { useMemo } from "react";
import type { LatLng } from "@/lib/geo";
import { SPORT_BY_ID } from "@/lib/sports";
import type { NearbyGame } from "@/lib/types";
import { UserDot } from "./game-marker";

interface Props {
  games: NearbyGame[];
  center: LatLng;
  user: LatLng | null;
  nearestId: string | null;
  highlight: string | null;
  onOpen: (g: NearbyGame) => void;
  onHover: (id: string | null) => void;
}

/**
 * Lightweight map used when no Google Maps key is configured (local dev, previews).
 * Pins are placed with a simple equirectangular projection around the search centre,
 * so relative positions and distances are right; there are just no real streets.
 */
export function SchematicMap({ games, center, user, nearestId, highlight, onOpen, onHover }: Props) {
  const project = useMemo(() => {
    const pts = [center, ...games.map((g) => ({ lat: g.lat, lng: g.lng })), ...(user ? [user] : [])];
    const cos = Math.cos((center.lat * Math.PI) / 180);
    const xs = pts.map((p) => (p.lng - center.lng) * cos);
    const ys = pts.map((p) => p.lat - center.lat);
    // Symmetric extent around the centre with padding so pins never touch the edges.
    const extent = Math.max(0.004, ...xs.map(Math.abs), ...ys.map(Math.abs)) * 1.25;
    return (p: LatLng) => ({
      left: `${50 + (((p.lng - center.lng) * cos) / extent) * 40}%`,
      // Vertical band keeps pins clear of the search bar/filters (top) and the summary card (bottom).
      top: `${50 - ((p.lat - center.lat) / extent) * 26}%`,
    });
  }, [games, center, user]);

  return (
    <div className="relative isolate size-full overflow-hidden bg-[#e9efe8] dark:bg-[#17221c]" role="region" aria-label="Map of nearby games">
      <SchematicStreets />

      {user && (
        <div className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={project(user)} title="You">
          <UserDot />
        </div>
      )}

      {games.map((g) => {
        const sport = SPORT_BY_ID[g.sport];
        const nearest = g.id === nearestId;
        const size = nearest ? 52 : 42;
        const full = g.players_count >= g.capacity;
        return (
          <button
            key={g.id}
            type="button"
            onClick={() => onOpen(g)}
            onMouseEnter={() => onHover(g.id)}
            onMouseLeave={() => onHover(null)}
            aria-label={`${sport.label} at ${g.spot_name}`}
            className={clsx("absolute flex -translate-x-1/2 -translate-y-full flex-col items-center transition-transform",
              highlight === g.id ? "z-30 scale-115" : nearest ? "z-20" : "z-10")}
            style={project(g)}
          >
            <span
              className={clsx("flex items-center justify-center rounded-full border-[3px] bg-white shadow-float",
                g.is_paid ? "border-[#f79009]" : "border-[#12b76a]", full && "opacity-60 grayscale")}
              style={{ width: size, height: size, fontSize: size * 0.5 }}
            >
              {sport.emoji}
            </span>
            {g.is_paid && <span className="absolute -right-1 -top-1 rounded-full bg-[#f79009] px-1.5 text-[10px] font-extrabold leading-4 text-white">₹</span>}
            <span className={clsx("-mt-1 size-2.5 rotate-45 border-b-[3px] border-r-[3px] bg-white", g.is_paid ? "border-[#f79009]" : "border-[#12b76a]")} />
          </button>
        );
      })}

      <p className="pointer-events-none absolute bottom-[8.5rem] left-3 rounded-full bg-surface/85 px-2.5 py-1 text-[11px] font-semibold text-muted md:bottom-24">
        Preview map · add a Google Maps key for street view
      </p>
    </div>
  );
}

/** Decorative streets, parks and a canal (no real geography). */
export function SchematicStreets() {
  return (
    <svg className="absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      <g className="fill-[#d6e8d2] dark:fill-[#1f3326]">
        <rect x="8" y="12" width="16" height="11" rx="1.5" />
        <rect x="62" y="64" width="20" height="14" rx="1.5" />
        <rect x="70" y="8" width="12" height="9" rx="1.5" />
      </g>
      <path d="M-5 78 C 25 70, 55 88, 105 72" className="fill-none stroke-[#cfe0f5] dark:stroke-[#1b2f45]" strokeWidth="3" />
      <g className="stroke-white dark:stroke-[#2a3a31]" fill="none" strokeLinecap="round">
        <path d="M0 35 L100 30" strokeWidth="2.2" />
        <path d="M0 58 L100 62" strokeWidth="1.6" />
        <path d="M38 0 L34 100" strokeWidth="2.2" />
        <path d="M72 0 L76 100" strokeWidth="1.4" />
        <path d="M14 0 L18 100" strokeWidth="0.9" />
        <path d="M0 15 L100 18" strokeWidth="0.8" />
        <path d="M0 86 L100 84" strokeWidth="0.8" />
        <path d="M55 0 L57 100" strokeWidth="0.8" />
      </g>
    </svg>
  );
}
