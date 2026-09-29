import { clsx } from "clsx";
import { Star } from "lucide-react";

/** "★ 4.6 (12)" or "No reviews yet". */
export function RatingSummary({ avg, count, className }: { avg: number | null; count: number; className?: string }) {
  if (!count || avg == null) return <span className={clsx("text-xs text-subtle", className)}>No reviews yet</span>;
  return (
    <span className={clsx("inline-flex items-center gap-1 text-sm font-semibold", className)} title={`${Number(avg).toFixed(1)} out of 5 from ${count} review${count === 1 ? "" : "s"}`}>
      <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
      {Number(avg).toFixed(1)}
      <span className="font-normal text-muted">({count})</span>
    </span>
  );
}

/** Read-only row of stars. */
export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex" aria-label={`${value} out of 5 stars`} role="img">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} aria-hidden style={{ width: size, height: size }}
          className={n <= value ? "fill-amber-400 text-amber-400" : "text-line"} />
      ))}
    </span>
  );
}

/** Tap a star to pick 1–5. */
export function StarPicker({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div role="radiogroup" aria-label="Rating" className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n === 1 ? "" : "s"}`}
          disabled={disabled} onClick={() => onChange(n)}
          className="rounded-md p-0.5 transition hover:scale-110 disabled:opacity-50">
          <Star className={clsx("size-7", n <= value ? "fill-amber-400 text-amber-400" : "text-line")} aria-hidden />
        </button>
      ))}
    </div>
  );
}
