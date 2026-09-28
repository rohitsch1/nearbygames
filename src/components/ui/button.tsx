import { clsx } from "clsx";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Spinner } from "./spinner";

type Variant = "primary" | "secondary" | "ghost" | "paid" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all select-none " +
  "disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-white hover:brightness-105 shadow-card dark:text-[#052e1a]",
  paid: "bg-paid text-white hover:brightness-105 shadow-card dark:text-[#2a1a02]",
  secondary: "bg-surface-2 text-ink hover:bg-line",
  outline: "border border-line bg-surface text-ink hover:bg-surface-2",
  ghost: "text-ink hover:bg-surface-2",
  danger: "bg-danger-soft text-danger hover:brightness-95",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-[15px]",
  lg: "h-13 px-6 text-base",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return clsx(base, variants[variant], sizes[size], className);
}

interface ButtonProps extends ComponentProps<"button"> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({ variant, size, loading, icon, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button className={buttonClass(variant, size, className)} disabled={disabled || loading} {...rest}>
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

interface LinkButtonProps extends ComponentProps<typeof Link> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

export function LinkButton({ variant, size, icon, className, children, ...rest }: LinkButtonProps) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}
