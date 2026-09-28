import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/game/json-ld";
import { SeoGameList } from "@/components/game/seo-game-list";
import { LinkButton } from "@/components/ui/button";
import { getUpcomingGames } from "@/lib/queries";
import { absoluteUrl, citySlug, site } from "@/lib/site";
import { SPORTS, SPORT_BY_SLUG } from "@/lib/sports";

export const revalidate = 300; // refresh listings every 5 minutes

export function generateStaticParams() {
  return SPORTS.map((s) => ({ sport: s.slug }));
}

export async function generateMetadata({ params }: PageProps<"/play/[sport]">): Promise<Metadata> {
  const { sport: slug } = await params;
  const sport = SPORT_BY_SLUG[slug];
  if (!sport) return {};
  const title = `${sport.label} games near me — join or host pickup ${sport.noun}`;
  const description = `Find pickup ${sport.noun} happening near you today. ${sport.blurb} Ask to join free games or pay your share for booked courts on nearbygames.`;
  return { title, description, alternates: { canonical: `/play/${sport.slug}` }, openGraph: { title, description, url: absoluteUrl(`/play/${sport.slug}`) } };
}

export default async function SportPage({ params }: PageProps<"/play/[sport]">) {
  const { sport: slug } = await params;
  const sport = SPORT_BY_SLUG[slug];
  if (!sport) notFound();
  const games = await getUpcomingGames({ sport: sport.id, limit: 30 });
  const cities = [...new Map(games.filter((g) => g.city && g.city_slug).map((g) => [g.city_slug!, g.city!])).entries()];
  const featured = site.featuredCities.filter((c) => !cities.some(([s]) => s === citySlug(c)));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Upcoming ${sport.noun} on ${site.name}`,
    itemListElement: games.slice(0, 20).map((g, i) => ({ "@type": "ListItem", position: i + 1, url: absoluteUrl(`/games/${g.slug}`), name: g.spot_name })),
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:px-8 md:py-16">
      <JsonLd data={jsonLd} />
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted">
        <Link href="/" className="hover:underline">Home</Link> › <Link href="/play" className="hover:underline">Sports</Link> › <span className="text-ink">{sport.label}</span>
      </nav>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-5xl" aria-hidden>{sport.emoji}</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight md:text-5xl">{sport.label} games near you</h1>
          <p className="mt-3 max-w-2xl text-lg text-muted">{sport.blurb} Free games need the host&apos;s yes; paid games let you pay your share and walk straight in.</p>
        </div>
        <LinkButton href="/map" size="lg" className="shrink-0">See them on the map</LinkButton>
      </div>

      <h2 className="mb-4 mt-12 text-xl font-bold">Upcoming {sport.noun}</h2>
      <SeoGameList games={games} sport={sport} />

      <section className="mt-14">
        <h2 className="mb-4 text-xl font-bold">{sport.label} by city</h2>
        <div className="flex flex-wrap gap-2">
          {cities.map(([s, name]) => (
            <Link key={s} href={`/play/${sport.slug}/${s}`} className="rounded-full border border-brand bg-brand-soft px-4 py-2 text-sm font-semibold text-brand-strong">{name}</Link>
          ))}
          {featured.map((c) => (
            <Link key={c} href={`/play/${sport.slug}/${citySlug(c)}`} className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold hover:border-brand">{c}</Link>
          ))}
        </div>
      </section>

      <section className="mt-14 grid gap-6 md:grid-cols-2">
        <div className="rounded-3xl border border-line bg-surface p-6">
          <h2 className="text-lg font-bold">How to join a {sport.label.toLowerCase()} game</h2>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-muted">
            <li>Open the map — every {sport.label.toLowerCase()} game near you shows as a {sport.emoji} marker.</li>
            <li>Tap one to see the time, spots left, price and the host&apos;s note.</li>
            <li>Free? Ask to join. Paid? Pay your share and you&apos;re in instantly.</li>
            <li>Chat with the host to sort the details.</li>
          </ol>
        </div>
        <div className="rounded-3xl border border-line bg-surface p-6">
          <h2 className="text-lg font-bold">Short a few players?</h2>
          <p className="mt-3 text-muted">Drop your {sport.label.toLowerCase()} game on the map and fill the last spots without spamming five group chats. Charge per player to split a booking, or keep it free and approve each person yourself.</p>
          <LinkButton href="/sign-in?next=/host/new" variant="outline" className="mt-4">Host a game</LinkButton>
        </div>
      </section>
    </div>
  );
}
