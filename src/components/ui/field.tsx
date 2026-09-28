import { clsx } from "clsx";
import type { ComponentProps, ReactNode } from "react";

export const inputClass =
  "w-full rounded-xl border border-line bg-surface px-3.5 h-11 text-[15px] text-ink placeholder:text-subtle " +
  "outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/15 disabled:opacity-60";

export function Input({ className, ...rest }: ComponentProps<"input">) {
  return <input className={clsx(inputClass, className)} {...rest} />;
}

export function Textarea({ className, ...rest }: ComponentProps<"textarea">) {
  return <textarea className={clsx(inputClass, "h-auto min-h-24 py-3 resize-none", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: ComponentProps<"select">) {
  return (
    <select className={clsx(inputClass, "appearance-none pr-9 bg-[length:16px] bg-[right_12px_center] bg-no-repeat", className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2398a2b3' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}
      {...rest}>
      {children}
    </select>
  );
}

export function Label({ children, htmlFor, hint }: { children: ReactNode; htmlFor?: string; hint?: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between gap-2 text-sm font-semibold text-ink">
      <span>{children}</span>
      {hint && <span className="text-xs font-normal text-subtle">{hint}</span>}
    </label>
  );
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p role="alert" className="mt-1.5 text-sm text-danger">{children}</p>;
}
