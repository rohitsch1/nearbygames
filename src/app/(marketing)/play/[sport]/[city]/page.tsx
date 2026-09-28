import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/game/json-ld";
import { SeoGameList } from "@/components/game/seo-game-list";
import { LinkButton } from "@/components/ui/button";
import { getUpcomingGames } from "@/lib/queries";
import { absoluteUrl, citySlug, site } from "@/lib/site";
import { SPORTS, SPORT_BY_SLUG } from "@/lib/sports";

export const revalidate = 300;

// Pre-render featured city pages for the headline sports; the rest render on first visit (ISR).
export function generateStaticParams() {
  const sports = ["football", "cricket", "badminton"];
  return sports.flatMap((sport) => site.featuredCities.map((c) => ({ sport, city: citySlug(c) })));
}

function cityName(slug: string, fromGames?: string | null) {
  if (fromGames) return fromGames;
  const featured = site.featuredCities.find((c) => citySlug(c) === slug);
  return featured ?? slug.split("-").map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ");
}

async function load(sportSlug: string, city: string) {
  const sport = SPORT_BY_SLUG[sportSlug];
  if (!sport || !/^[a-z0-9-]{2,60}$/.test(city)) return null;
  const games = await getUpcomingGames({ sport: sport.id, citySlug: city, limit: 40 });
  const featured = site.featuredCities.some((c) => citySlug(c) === city);
  return { sport, games, name: cityName(city, games[0]?.city), featured };
}

export async function generateMetadata({ params }: PageProps<"/play/[sport]/[city]">): Promise<Metadata> {
  const { sport, city } = await params;
  const data = await load(sport, city);
  if (!data) return {};
  const title = `${data.sport.label} games in ${data.name} — pickup ${data.sport.noun} near you`;
  const description = `${data.games.length ? `${data.games.length} upcoming` : "Find and host"} pickup ${data.sport.noun} in ${data.name}. ${data.sport.blurb}`;
  return {
    title,
    description,
    alternates: { canonical: `/play/${data.sport.slug}/${city}` },
    openGraph: { title, description, url: absoluteUrl(`/play/${data.sport.slug}/${city}`) },
    // Avoid thin pages in the index: only list cities that are featured or have real games.
    robots: data.games.length || data.featured ? { index: true, follow: true } : { index: false, follow: true },
  };
}

export default async function SportCityPage({ params }: PageProps<"/play/[sport]/[city]">) {
  const { sport: sportSlug, city } = await params;
  const data = await load(sportSlug, city);
  if (!data) notFound();
  const { sport, games, name } = data;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: site.name, item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: sport.label, item: absoluteUrl(`/play/${sport.slug}`) },
      { "@type": "ListItem", position: 3, name, item: absoluteUrl(`/play/${sport.slug}/${city}`) },
    ],
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:px-8 md:py-16">
      <JsonLd data={jsonLd} />
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted">
        <Link href="/" className="hover:underline">Home</Link> › <Link href={`/play/${sport.slug}`} className="hover:underline">{sport.label}</Link> › <span className="text-ink">{name}</span>
      </nav>
      <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">{sport.emoji} {sport.label} in {name}</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">
        Pickup {sport.noun} happening across {name}. Tap a game to see spots left and the host&apos;s note, then ask to join or pay your share.
      </p>
      <div className="mt-6"><LinkButton href="/map" size="lg">Open the live map</LinkButton></div>

      <h2 className="mb-4 mt-12 text-xl font-bold">Upcoming {sport.noun} in {name}</h2>
      <SeoGameList games={games} sport={sport} where={name} />

      <section className="mt-14">
        <h2 className="mb-4 text-xl font-bold">Other sports in {name}</h2>
        <div className="flex flex-wrap gap-2">
          {SPORTS.filter((s) => s.id !== sport.id && s.id !== "other").map((s) => (
            <Link key={s.id} href={`/play/${s.slug}/${city}`} className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold hover:border-brand">
              {s.emoji} {s.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
