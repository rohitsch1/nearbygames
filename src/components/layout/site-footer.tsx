import Link from "next/link";
import { site, citySlug } from "@/lib/site";
import { SPORTS } from "@/lib/sports";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-4 md:px-8">
        <div>
          <Logo />
          <p className="mt-3 text-sm text-muted">{site.tagline}. Free games are a request. Paid games are a transaction.</p>
        </div>
        <nav aria-label="Sports">
          <h2 className="mb-3 text-sm font-bold">Sports</h2>
          <ul className="grid grid-cols-2 gap-2 text-sm text-muted md:grid-cols-1">
            {SPORTS.filter((s) => s.id !== "other").slice(0, 8).map((s) => (
              <li key={s.id}><Link href={`/play/${s.slug}`} className="hover:text-ink">{s.label} near me</Link></li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Cities">
          <h2 className="mb-3 text-sm font-bold">Popular cities</h2>
          <ul className="grid grid-cols-2 gap-2 text-sm text-muted md:grid-cols-1">
            {site.featuredCities.slice(0, 8).map((c) => (
              <li key={c}><Link href={`/play/football/${citySlug(c)}`} className="hover:text-ink">Football in {c}</Link></li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Company">
          <h2 className="mb-3 text-sm font-bold">nearbygames</h2>
          <ul className="space-y-2 text-sm text-muted">
            <li><Link href="/map" className="hover:text-ink">Open the map</Link></li>
            <li><Link href="/host/new" className="hover:text-ink">Host a game</Link></li>
            <li><Link href="/privacy" className="hover:text-ink">Privacy</Link></li>
            <li><Link href="/terms" className="hover:text-ink">Terms</Link></li>
          </ul>
        </nav>
      </div>
      <p className="border-t border-line py-6 text-center text-xs text-subtle">© {new Date().getFullYear()} {site.name}. Made for people who just want to play.</p>
    </footer>
  );
}
