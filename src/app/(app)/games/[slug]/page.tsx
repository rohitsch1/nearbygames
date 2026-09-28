import { CalendarClock, Clock, MapPin, Navigation, Users } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DistanceFromYou } from "@/components/game/distance-from-you";
import { GameActions } from "@/components/game/game-actions";
import { GameLocationMap } from "@/components/game/game-location-map";
import { HostTools } from "@/components/game/host-tools";
import { JsonLd } from "@/components/game/json-ld";
import { ShareButton } from "@/components/game/share-button";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { formatFullDate, formatWhen, firstName } from "@/lib/format";
import { googleMapsDirectionsUrl } from "@/lib/geo";
import { formatINR, platformFee } from "@/lib/money";
import { canTransact } from "@/lib/profile";
import { getGameBySlug, getViewerState } from "@/lib/queries";
import { absoluteUrl, site } from "@/lib/site";
import { SPORT_BY_ID } from "@/lib/sports";
import { createClient, getSession } from "@/lib/supabase/server";

export async function generateMetadata({ params }: PageProps<"/games/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  if (!game) return { title: "Game not found", robots: { index: false } };
  const sport = SPORT_BY_ID[game.sport];
  const when = formatWhen(game.starts_at);
  const place = [game.spot_name, game.city].filter(Boolean).join(", ");
  const spots = Math.max(game.capacity - game.players_count, 0);
  const title = `${sport.label} at ${place} · ${when}`;
  const description = `${game.is_paid ? `${formatINR(game.fee_paise)} per player` : "Free game"} · ${spots} of ${game.capacity} spots open. ${
    game.notes ? game.notes.slice(0, 110) : `Join a pickup ${sport.label.toLowerCase()} game hosted by ${firstName(game.host.full_name)} on nearbygames.`}`;
  const ended = new Date(game.starts_at).getTime() + game.duration_minutes * 60_000 < Date.now();
  return {
    title,
    description,
    alternates: { canonical: `/games/${game.slug}` },
    openGraph: { type: "website", title, description, url: absoluteUrl(`/games/${game.slug}`) },
    twitter: { card: "summary_large_image", title, description },
    // Past/cancelled games stay reachable but drop out of search results.
    robots: game.status === "cancelled" || ended ? { index: false, follow: true } : { index: true, follow: true },
  };
}

export default async function GamePage({ params }: PageProps<"/games/[slug]">) {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  if (!game) notFound();

  const session = await getSession();
  const { state, participants, pendingCount } = await getViewerState(game, session?.userId ?? null, canTransact(session?.profile));
  let home: { lat: number; lng: number } | null = null;
  if (session) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("my_home_location");
    home = (data as { lat: number; lng: number }[] | null)?.[0] ?? null;
  }

  const sport = SPORT_BY_ID[game.sport];
  const spots = Math.max(game.capacity - game.players_count, 0);
  const endsAt = new Date(new Date(game.starts_at).getTime() + game.duration_minutes * 60_000);
  const started = new Date(game.starts_at) < new Date();
  const fee = game.is_paid ? platformFee(game.fee_paise) : 0;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${sport.label} at ${game.spot_name}`,
    description: game.notes ?? `Pickup ${sport.label.toLowerCase()} game on nearbygames.`,
    sport: sport.label,
    startDate: game.starts_at,
    endDate: endsAt.toISOString(),
    eventStatus: game.status === "cancelled" ? "https://schema.org/EventCancelled" : "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    maximumAttendeeCapacity: game.capacity,
    remainingAttendeeCapacity: spots,
    url: absoluteUrl(`/games/${game.slug}`),
    image: game.photo_url ? [game.photo_url] : [absoluteUrl("/opengraph-image")],
    location: {
      "@type": "Place",
      name: game.spot_name,
      address: { "@type": "PostalAddress", addressLocality: game.city ?? undefined, addressCountry: "IN" },
      geo: { "@type": "GeoCoordinates", latitude: game.lat, longitude: game.lng },
    },
    organizer: { "@type": "Person", name: firstName(game.host.full_name, "nearbygames host") },
    offers: {
      "@type": "Offer",
      price: game.is_paid ? ((game.fee_paise + fee) / 100).toFixed(2) : "0",
      priceCurrency: "INR",
      availability: spots > 0 ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
      url: absoluteUrl(`/games/${game.slug}`),
      validFrom: game.created_at,
    },
  };
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: site.name, item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: sport.label, item: absoluteUrl(`/play/${sport.slug}`) },
      ...(game.city_slug ? [{ "@type": "ListItem", position: 3, name: game.city, item: absoluteUrl(`/play/${sport.slug}/${game.city_slug}`) }] : []),
      { "@type": "ListItem", position: game.city_slug ? 4 : 3, name: game.spot_name, item: absoluteUrl(`/games/${game.slug}`) },
    ],
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-44 md:px-8 md:pb-12">
      <JsonLd data={[jsonLd, breadcrumbs]} />
      <PageHeader title={game.spot_name} back="/map" action={<ShareButton title={`${sport.label} at ${game.spot_name}`} />} />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:gap-8">
        <article className="min-w-0 space-y-6">
          {/* Hero */}
          <div className="relative -mx-4 aspect-[16/9] overflow-hidden bg-surface-2 sm:mx-0 sm:rounded-3xl">
            {game.photo_url ? (
              <Image src={game.photo_url} alt={`${game.spot_name} — ${sport.label} ground`} fill priority sizes="(min-width: 1024px) 700px, 100vw" className="object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center bg-gradient-to-br from-brand-soft to-surface-2 text-8xl" aria-hidden>{sport.emoji}</div>
            )}
            <div className="absolute left-4 top-4 flex gap-2">
              <Badge tone={game.is_paid ? "paid" : "brand"} className="!text-sm shadow-card">{game.is_paid ? `${formatINR(game.fee_paise)} / player` : "Free"}</Badge>
              {game.status === "cancelled" && <Badge tone="danger" className="!text-sm shadow-card">Cancelled</Badge>}
            </div>
          </div>

          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-brand-strong">{sport.emoji} {sport.label}</p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight md:text-3xl">{game.spot_name}</h2>
            {game.city && <p className="mt-1 flex items-center gap-1 text-muted"><MapPin className="size-4" /> {game.city}</p>}
          </div>

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Fact icon={<CalendarClock className="size-4" />} label="Starts" value={formatWhen(game.starts_at)} title={formatFullDate(game.starts_at)} />
            <Fact icon={<Clock className="size-4" />} label="Duration" value={`${game.duration_minutes} min`} />
            <Fact icon={<Users className="size-4" />} label="Spots open" value={spots === 0 ? "Full" : `${spots} of ${game.capacity}`} />
            <Fact icon={<Navigation className="size-4" />} label="Distance" value={<DistanceFromYou lat={game.lat} lng={game.lng} home={home} />} />
          </dl>

          {game.notes && (
            <section className="rounded-2xl border border-line bg-surface p-4">
              <h3 className="mb-2 text-sm font-bold text-muted">Note from {firstName(game.host.full_name, "the host")}</h3>
              <p className="whitespace-pre-line">{game.notes}</p>
            </section>
          )}

          <section className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-center gap-3">
              <Avatar name={game.host.full_name} src={game.host.avatar_url} size={48} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-subtle">Hosted by</p>
                <p className="truncate font-bold">{game.host.full_name ?? "A nearbygames player"}</p>
                {game.host.area_name && <p className="truncate text-sm text-muted">{game.host.area_name}</p>}
              </div>
            </div>
            {participants.length > 1 && (
              <div className="mt-4 flex items-center gap-3 border-t border-line pt-4">
                <AvatarStack people={participants.filter((p) => p.user_id !== game.host_id).map((p) => ({ name: p.profile.full_name, src: p.profile.avatar_url }))} />
                <p className="text-sm text-muted">
                  {participants.length - 1} player{participants.length === 2 ? "" : "s"} already in
                </p>
              </div>
            )}
            {!session && game.players_count > 1 && (
              <p className="mt-4 border-t border-line pt-4 text-sm text-muted">{game.players_count - 1} players already in · sign in to see who</p>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">Where</h3>
              <a href={googleMapsDirectionsUrl(game)} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-brand-strong">
                Directions ↗
              </a>
            </div>
            <GameLocationMap lat={game.lat} lng={game.lng} sport={game.sport} />
          </section>

          {state.kind === "host" && (
            <HostTools gameId={game.id} started={started} cancelled={game.status === "cancelled"}
              players={participants.filter((p) => p.user_id !== game.host_id)} />
          )}

          <nav aria-label="Breadcrumb" className="text-sm text-muted">
            <Link href="/" className="hover:underline">Home</Link> ›{" "}
            <Link href={`/play/${sport.slug}`} className="hover:underline">{sport.label}</Link>
            {game.city_slug && <> › <Link href={`/play/${sport.slug}/${game.city_slug}`} className="hover:underline">{game.city}</Link></>}
          </nav>
        </article>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <GameActions
            gameId={game.id}
            slug={game.slug}
            state={state}
            hostName={firstName(game.host.full_name, "the host")}
            isPaid={game.is_paid}
            priceLabel={game.is_paid ? formatINR(game.fee_paise + fee) : null}
            pendingCount={pendingCount}
          />
        </aside>
      </div>
    </div>
  );
}

function Fact({ icon, label, value, title }: { icon: React.ReactNode; label: string; value: React.ReactNode; title?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3" title={title}>
      <dt className="flex items-center gap-1.5 text-xs font-semibold text-subtle">{icon} {label}</dt>
      <dd className="mt-1 font-bold">{value}</dd>
    </div>
  );
}
