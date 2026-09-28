import { clsx } from "clsx";
import Link from "next/link";

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="var(--brand)" />
      <path d="M16 6.5c-4.1 0-7.3 3.2-7.3 7.2 0 5.2 6.1 10.9 6.7 11.5.3.3.9.3 1.2 0 .6-.6 6.7-6.3 6.7-11.5 0-4-3.2-7.2-7.3-7.2Z" fill="#fff" />
      <circle cx="16" cy="13.7" r="3.1" fill="var(--brand)" />
    </svg>
  );
}

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={clsx("inline-flex items-center gap-2 font-extrabold tracking-tight", className)} aria-label="nearbygames home">
      <LogoMark />
      <span className="text-lg">nearby<span className="text-brand">games</span></span>
    </Link>
  );
}
