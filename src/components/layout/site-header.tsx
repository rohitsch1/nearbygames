import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { Logo } from "./logo";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 md:px-8">
        <Logo />
        <nav aria-label="Primary" className="ml-auto hidden items-center gap-6 text-sm font-semibold text-muted md:flex">
          <Link href="/play" className="hover:text-ink">Sports</Link>
          <Link href="/#how-it-works" className="hover:text-ink">How it works</Link>
          <Link href="/#faq" className="hover:text-ink">FAQ</Link>
          <Link href="/map" className="hover:text-ink">Open map</Link>
        </nav>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <Link href="/sign-in" className="hidden text-sm font-semibold text-muted hover:text-ink sm:block">Sign in</Link>
          <LinkButton href="/map" size="sm">Find a game</LinkButton>
        </div>
      </div>
    </header>
  );
}
