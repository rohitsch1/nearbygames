import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/** Sticky title bar used by in-app pages (mobile-first; becomes a plain heading on desktop). */
export function PageHeader({ title, back, action, subtitle }: { title: string; back?: string; action?: ReactNode; subtitle?: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 -mx-4 mb-4 flex items-center gap-2 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:pt-6 md:backdrop-blur-none">
      {back && (
        <Link href={back} aria-label="Back" className="-ml-2 flex size-9 items-center justify-center rounded-full hover:bg-surface-2">
          <ChevronLeft className="size-5" />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-bold md:text-2xl">{title}</h1>
        {subtitle && <p className="truncate text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
