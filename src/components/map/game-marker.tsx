"use client";

import { AdvancedMarker } from "@vis.gl/react-google-maps";
import { clsx } from "clsx";
import { memo } from "react";
import { SPORT_BY_ID } from "@/lib/sports";
import type { NearbyGame } from "@/lib/types";

interface Props {
  game: NearbyGame;
  nearest: boolean;
  highlighted: boolean;
  onClick: (g: NearbyGame) => void;
  onHover?: (id: string | null) => void;
}

/** Map pin: sport emoji in a bubble. Paid = amber ring, nearest = bigger. */
export const GameMarker = memo(function GameMarker({ game, nearest, highlighted, onClick, onHover }: Props) {
  const sport = SPORT_BY_ID[game.sport];
  const full = game.players_count >= game.capacity;
  const size = nearest ? 52 : 42;
  return (
    <AdvancedMarker
      position={{ lat: game.lat, lng: game.lng }}
      onClick={() => onClick(game)}
      title={`${sport.label} at ${game.spot_name}`}
      zIndex={highlighted ? 1000 : nearest ? 500 : undefined}
    >
      <div
        onMouseEnter={() => onHover?.(game.id)}
        onMouseLeave={() => onHover?.(null)}
        className={clsx("relative flex flex-col items-center transition-transform duration-150", highlighted && "scale-115")}
      >
        <div
          className={clsx(
            "flex items-center justify-center rounded-full border-[3px] bg-white shadow-float",
            game.is_paid ? "border-[#f79009]" : "border-[#12b76a]",
            full && "opacity-60 grayscale",
          )}
          style={{ width: size, height: size, fontSize: size * 0.5 }}
        >
          <span aria-hidden>{sport.emoji}</span>
        </div>
        {game.is_paid && (
          <span className="absolute -right-1 -top-1 rounded-full bg-[#f79009] px-1.5 text-[10px] font-extrabold leading-4 text-white">₹</span>
        )}
        <span className={clsx("-mt-1 h-2.5 w-2.5 rotate-45 border-b-[3px] border-r-[3px] bg-white",
          game.is_paid ? "border-[#f79009]" : "border-[#12b76a]")} />
      </div>
    </AdvancedMarker>
  );
});

export function UserDot() {
  return (
    <span className="relative flex size-5">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-sky-400 opacity-60" />
      <span className="relative inline-flex size-5 rounded-full border-[3px] border-white bg-sky-500 shadow-float" />
    </span>
  );
}
