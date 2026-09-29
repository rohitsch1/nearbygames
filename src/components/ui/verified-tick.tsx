import { clsx } from "clsx";
import { Check } from "lucide-react";

/** Blue tick shown next to people who completed the ID check. */
export function VerifiedTick({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <span title="ID verified" aria-label="ID verified" role="img"
      className={clsx("inline-flex shrink-0 items-center justify-center rounded-full bg-[#1d9bf0] text-white", className)}
      style={{ width: size, height: size }}>
      <Check strokeWidth={3.5} style={{ width: size * 0.65, height: size * 0.65 }} aria-hidden />
    </span>
  );
}
