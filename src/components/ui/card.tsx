import { clsx } from "clsx";
import type { ComponentProps } from "react";

export function Card({ className, ...rest }: ComponentProps<"div">) {
  return <div className={clsx("rounded-2xl border border-line bg-surface shadow-card", className)} {...rest} />;
}

export function EmptyState({ icon, title, body, action }: { icon: React.ReactNode; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center animate-fade-up">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-surface-2 text-2xl text-muted">{icon}</div>
      <h3 className="text-base font-bold">{title}</h3>
      {body && <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
