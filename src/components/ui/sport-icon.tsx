import { clsx } from "clsx";
import { SPORT_BY_ID } from "@/lib/sports";
import type { Sport } from "@/lib/types";

export function SportIcon({ sport, size = 40, className }: { sport: Sport; size?: number; className?: string }) {
  const s = SPORT_BY_ID[sport];
  return (
    <span role="img" aria-label={s.label}
      className={clsx("inline-flex shrink-0 items-center justify-center rounded-xl bg-surface-2", className)}
      style={{ width: size, height: size, fontSize: size * 0.55 }}>
      {s.emoji}
    </span>
  );
}
