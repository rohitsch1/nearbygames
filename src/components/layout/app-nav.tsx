"use client";

import { clsx } from "clsx";
import { Bell, Map, MessageCircle, Plus, User, LogIn } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "./logo";
import { usePendingRequests } from "@/hooks/use-pending-requests";
import { Avatar } from "@/components/ui/avatar";

interface Props {
  userId: string | null;
  name: string | null;
  avatarUrl: string | null;
  initialPending: number;
}

const items = [
  { href: "/map", label: "Map", icon: Map, match: /^\/(map|games)/ },
  { href: "/requests", label: "Requests", icon: Bell, match: /^\/requests/, badge: true },
  { href: "/host/new", label: "Start a game", short: "Host", icon: Plus, match: /^\/host/, primary: true },
  { href: "/messages", label: "Messages", icon: MessageCircle, match: /^\/messages/ },
  { href: "/me", label: "Me", icon: User, match: /^\/me/ },
];

export function AppNav({ userId, name, avatarUrl, initialPending }: Props) {
  const pathname = usePathname();
  const pending = usePendingRequests(userId, initialPending);
  const hideOnMobile = /^\/messages\/[^/]+/.test(pathname) || /^\/onboarding/.test(pathname);

  return (
    <>
      {/* Tablet & desktop: left rail */}
      <nav aria-label="Main" className="fixed inset-y-0 left-0 z-40 hidden w-20 flex-col items-center gap-1 border-r border-line bg-surface py-4 md:flex lg:w-60 lg:items-stretch lg:px-3">
        <Link href="/map" className="mb-6 flex items-center gap-2 px-2 font-extrabold" aria-label="nearbygames">
          <LogoMark size={36} />
          <span className="hidden text-lg lg:inline">nearby<span className="text-brand">games</span></span>
        </Link>
        {items.map((it) => {
          const active = it.match.test(pathname);
          const Icon = it.icon;
          if (!userId && it.href !== "/map") return null;
          return (
            <Link key={it.href} href={it.href} aria-current={active ? "page" : undefined}
              className={clsx(
                "group relative flex h-12 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold transition",
                it.primary ? "my-2 bg-brand text-white hover:brightness-105 dark:text-[#052e1a]" :
                active ? "bg-brand-soft text-brand-strong" : "text-muted hover:bg-surface-2 hover:text-ink",
              )}>
              <Icon className="size-5 shrink-0" />
              <span className="hidden lg:inline">{it.label}</span>
              {it.badge && pending > 0 && (
                <span className="absolute left-7 top-2 min-w-5 rounded-full bg-danger px-1.5 text-center text-[11px] font-bold leading-5 text-white lg:static lg:ml-auto">
                  {pending > 99 ? "99+" : pending}
                </span>
              )}
            </Link>
          );
        })}
        <div className="mt-auto w-full">
          {userId ? (
            <Link href="/me" className="flex items-center gap-3 rounded-xl p-2 hover:bg-surface-2">
              <Avatar name={name} src={avatarUrl} size={36} />
              <span className="hidden truncate text-sm font-semibold lg:inline">{name ?? "Your profile"}</span>
            </Link>
          ) : (
            <Link href="/sign-in" className="flex h-12 items-center justify-center gap-2 rounded-xl bg-brand px-3 font-semibold text-white lg:justify-start">
              <LogIn className="size-5" /><span className="hidden lg:inline">Sign in</span>
            </Link>
          )}
        </div>
      </nav>

      {/* Mobile: bottom bar */}
      {!hideOnMobile && (
        <nav aria-label="Main" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur md:hidden">
          <ul className="grid h-16 grid-cols-5">
            {items.map((it) => {
              const active = it.match.test(pathname);
              const Icon = it.icon;
              const href = !userId && it.href !== "/map" ? `/sign-in?next=${encodeURIComponent(it.href)}` : it.href;
              return (
                <li key={it.href}>
                  <Link href={href} aria-current={active ? "page" : undefined}
                    className={clsx("relative flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold",
                      active ? "text-brand-strong" : "text-subtle")}>
                    {it.primary ? (
                      <span className="-mt-5 flex size-12 items-center justify-center rounded-2xl bg-brand text-white shadow-float dark:text-[#052e1a]">
                        <Icon className="size-6" />
                      </span>
                    ) : (
                      <Icon className="size-[22px]" strokeWidth={active ? 2.5 : 2} />
                    )}
                    <span>{it.short ?? it.label}</span>
                    {it.badge && pending > 0 && (
                      <span className="absolute left-1/2 top-1.5 ml-1.5 min-w-4.5 rounded-full bg-danger px-1 text-center text-[10px] font-bold leading-[18px] text-white">
                        {pending > 9 ? "9+" : pending}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </>
  );
}
