"use client";

import { clsx } from "clsx";
import { Users } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { SportIcon } from "@/components/ui/sport-icon";
import { formatDistance, formatWhen } from "@/lib/format";
import { formatINR } from "@/lib/money";
import type { Sport } from "@/lib/types";

export interface GameListItemData {
  slug: string;
  sport: Sport;
  spot_name: string;
  city?: string | null;
  starts_at: string;
  capacity: number;
  players_count: number;
  is_paid: boolean;
  fee_paise: number;
  distance_m?: number | null;
}

export function GameListItem({ game, highlighted, onHover }: { game: GameListItemData; highlighted?: boolean; onHover?: (h: boolean) => void }) {
  const spots = Math.max(game.capacity - game.players_count, 0);
  return (
    <Link href={`/games/${game.slug}`}
      onMouseEnter={() => onHover?.(true)} onMouseLeave={() => onHover?.(false)}
      className={clsx("flex items-center gap-3 rounded-2xl border bg-surface p-3 transition hover:shadow-card",
        highlighted ? "border-brand ring-2 ring-brand/20" : "border-line")}>
      <SportIcon sport={game.sport} size={48} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{game.spot_name}</p>
        <p className="truncate text-sm text-muted" suppressHydrationWarning>
          {formatWhen(game.starts_at)}
          {game.distance_m != null && <> · {formatDistance(game.distance_m)}</>}
        </p>
        <div className="mt-1.5 flex items-center gap-1.5">
          {game.is_paid ? <Badge tone="paid">{formatINR(game.fee_paise)}</Badge> : <Badge tone="brand">Free</Badge>}
          <Badge tone={spots === 0 ? "danger" : "neutral"}>
            <Users className="size-3" /> {spots === 0 ? "Full" : `${spots} spot${spots === 1 ? "" : "s"} left`}
          </Badge>
        </div>
      </div>
    </Link>
  );
}
