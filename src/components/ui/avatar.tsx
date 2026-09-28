import { clsx } from "clsx";
import Image from "next/image";
import { initials } from "@/lib/format";

const palette = ["bg-emerald-100 text-emerald-800", "bg-sky-100 text-sky-800", "bg-amber-100 text-amber-800",
  "bg-rose-100 text-rose-800", "bg-violet-100 text-violet-800", "bg-teal-100 text-teal-800"];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function Avatar({ name, src, size = 40, className }: { name?: string | null; src?: string | null; size?: number; className?: string }) {
  const style = { width: size, height: size, fontSize: Math.max(11, size * 0.38) };
  if (src) {
    return (
      <Image src={src} alt={name ?? "Player"} width={size} height={size}
        className={clsx("shrink-0 rounded-full object-cover bg-surface-2", className)} style={style} />
    );
  }
  return (
    <span aria-label={name ?? "Player"} role="img"
      className={clsx("inline-flex shrink-0 items-center justify-center rounded-full font-bold", palette[hash(name ?? "?") % palette.length], className)}
      style={style}>
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ people, max = 4, size = 28 }: { people: { name: string | null; src: string | null }[]; max?: number; size?: number }) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <div className="flex items-center -space-x-2">
      {shown.map((p, i) => <Avatar key={i} name={p.name} src={p.src} size={size} className="ring-2 ring-surface" />)}
      {extra > 0 && (
        <span className="inline-flex items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-muted ring-2 ring-surface"
          style={{ width: size, height: size }}>+{extra}</span>
      )}
    </div>
  );
}
