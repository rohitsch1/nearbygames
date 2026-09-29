"use client";

import { AdvancedMarker, Map as GoogleMap, useMap } from "@vis.gl/react-google-maps";
import { clsx } from "clsx";
import { Bell, Clock, List, LocateFixed, Map as MapIcon, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameListItem } from "@/components/game/game-list-item";
import { EmptyState } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { usePendingRequests } from "@/hooks/use-pending-requests";
import { useUserLocation } from "@/hooks/use-user-location";
import { env } from "@/lib/env";
import { formatStartsIn } from "@/lib/format";
import { DEFAULT_CENTER, haversineMeters, type LatLng } from "@/lib/geo";
import { SPORTS, SPORT_BY_ID } from "@/lib/sports";
import { createClient } from "@/lib/supabase/client";
import type { NearbyGame, Sport } from "@/lib/types";
import { GameMarker, UserDot } from "./game-marker";
import { hasMapsKey, MapsProvider, useReverseGeocode } from "./maps-provider";
import { PlaceSearch } from "./place-search";
import { SchematicMap } from "./schematic-map";

interface Props {
  userId: string | null;
  home: LatLng | null;
  areaName: string | null;
  favouriteSports: Sport[];
}

interface Filters { soon: boolean; free: boolean; sport: Sport | null }

export function GameMap(props: Props) {
  return (
    <MapsProvider>
      <GameMapInner {...props} />
    </MapsProvider>
  );
}

function GameMapInner({ userId, home, areaName, favouriteSports }: Props) {
  const router = useRouter();
  const reverseGeocode = useReverseGeocode();
  const pending = usePendingRequests(userId);

  const initialCenter = home ?? DEFAULT_CENTER;
  const [query, setQuery] = useState<{ center: LatLng; radius: number }>({ center: initialCenter, radius: 15000 });
  const [filters, setFilters] = useState<Filters>({ soon: false, free: false, sport: null });
  const requestKey = JSON.stringify([query, filters]);
  const [result, setResult] = useState<{ key: string; games: NearbyGame[]; error: boolean }>({ key: "", games: [], error: false });
  const games = result.games;
  const error = result.error && result.key === requestKey;
  const loading = result.key !== requestKey;
  const [highlight, setHighlight] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<LatLng | null>(null);
  const [label, setLabel] = useState(areaName ?? "Near you");
  const [mobileView, setMobileView] = useState<"map" | "list">("map");
  const lastGeocoded = useRef<LatLng | null>(null);
  const { position, status, locate } = useUserLocation((p) => {
    // First live fix: fly there (and, without a map, search around it).
    setFlyTo(p);
    if (!hasMapsKey) setQuery((q) => ({ ...q, center: p }));
  });

  // Fetch games for the visible area.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    supabase
      .rpc("nearby_games", {
        p_lat: query.center.lat,
        p_lng: query.center.lng,
        p_radius_m: Math.round(query.radius),
        p_sport: filters.sport,
        p_within_minutes: filters.soon ? 120 : null,
        p_free_only: filters.free,
      })
      .then(({ data, error: err }) => {
        if (cancelled) return;
        setResult((prev) => ({ key: requestKey, games: err ? prev.games : ((data ?? []) as NearbyGame[]), error: Boolean(err) }));
      });
    return () => { cancelled = true; };
  }, [query, filters, requestKey]);

  // Distances shown to the user are from *them* (live or saved neighbourhood), computed on-device.
  const ref = position ?? home;
  const withDistance = useMemo(
    () => games.map((g) => ({ ...g, distance_m: ref ? Math.round(haversineMeters(ref, g)) : g.distance_m })),
    [games, ref],
  );
  const nearestId = useMemo(
    () => withDistance.reduce<NearbyGame | null>((best, g) => (!best || g.distance_m < best.distance_m ? g : best), null)?.id ?? null,
    [withDistance],
  );
  const nextGame = useMemo(
    () => withDistance.filter((g) => new Date(g.starts_at) > new Date()).sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0],
    [withDistance],
  );

  async function onCameraIdle(center: LatLng, ne: LatLng | null) {
    const radius = ne ? Math.min(Math.max(haversineMeters(center, ne), 1000), 50000) : 8000;
    setQuery((q) => (haversineMeters(q.center, center) < 150 && Math.abs(q.radius - radius) < 300 ? q : { center, radius }));
    // Update the "where am I looking" label, but not on every tiny pan (saves geocoding calls).
    if (!lastGeocoded.current || haversineMeters(lastGeocoded.current, center) > 1500) {
      lastGeocoded.current = center;
      const { area, city } = await reverseGeocode(center.lat, center.lng);
      if (area || city) setLabel([area, city].filter((v, i, a) => v && a.indexOf(v) === i).join(", "));
    }
  }

  const recenter = async () => {
    const target = position ?? (await locate()) ?? home;
    if (!target) return;
    setFlyTo({ ...target });
    if (!hasMapsKey) setQuery((q) => ({ ...q, center: target }));
  };

  const openGame = useCallback((g: NearbyGame) => router.push(`/games/${g.slug}`), [router]);

  const sportChips = useMemo(() => {
    const fav = SPORTS.filter((s) => favouriteSports.includes(s.id));
    const rest = SPORTS.filter((s) => !favouriteSports.includes(s.id) && s.id !== "other");
    return [...fav, ...rest];
  }, [favouriteSports]);

  const filterBar = (
    <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
      {status !== "live" && (
        <Chip on={false} onClick={recenter}>
          {status === "locating" ? <Spinner className="size-3.5" /> : <LocateFixed className="size-3.5 text-info" />} Near me
        </Chip>
      )}
      <Chip on={filters.soon} onClick={() => setFilters((f) => ({ ...f, soon: !f.soon }))}>
        <Clock className="size-3.5" /> Next 2 hours
      </Chip>
      <Chip on={filters.free} onClick={() => setFilters((f) => ({ ...f, free: !f.free }))}>Free only</Chip>
      <span className="my-1 w-px shrink-0 bg-line" />
      {sportChips.map((s) => (
        <Chip key={s.id} on={filters.sport === s.id} onClick={() => setFilters((f) => ({ ...f, sport: f.sport === s.id ? null : s.id }))}>
          <span aria-hidden>{s.emoji}</span> {s.label}
        </Chip>
      ))}
    </div>
  );

  const list = (
    <div className="space-y-2">
      {loading && games.length === 0 ? (
        Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[84px] animate-pulse rounded-2xl bg-surface-2" />)
      ) : error ? (
        <EmptyState icon="⚠️" title="Couldn't load games" body="Check your connection and try again." />
      ) : withDistance.length === 0 ? (
        <EmptyState icon={<Sparkles className="size-6" />} title="No games here yet"
          body={filters.soon || filters.free || filters.sport ? "Try removing a filter or zooming out." : "Be the first — drop a game on the map and people nearby will see it within seconds."}
          action={<Link href={userId ? "/host/new" : "/sign-in?next=/host/new"} className="font-semibold text-brand-strong">Start a game →</Link>} />
      ) : (
        [...withDistance].sort((a, b) => a.starts_at.localeCompare(b.starts_at)).map((g) => (
          <GameListItem key={g.id} game={g} highlighted={highlight === g.id} onHover={(h) => setHighlight(h ? g.id : null)} />
        ))
      )}
    </div>
  );

  const summary = (
    <p className="text-sm">
      <span className="font-bold">{withDistance.length} game{withDistance.length === 1 ? "" : "s"}</span>
      <span className="text-muted"> {filters.sport ? `of ${SPORT_BY_ID[filters.sport].label.toLowerCase()} ` : ""}visible</span>
      {nextGame && <span className="text-muted"> · next kicks off {formatStartsIn(nextGame.starts_at)}</span>}
    </p>
  );

  return (
    <div className="flex h-[calc(100dvh-4rem-env(safe-area-inset-bottom))] md:h-dvh">
      {/* Side panel (tablet/desktop) */}
      <aside className="hidden w-80 shrink-0 flex-col border-r border-line bg-bg md:flex lg:w-[400px]">
        <div className="space-y-3 border-b border-line p-4">
          <h2 className="text-xl font-extrabold">{label === "Near you" ? "Games near you" : `Games near ${label.split(",")[0]}`}</h2>
          {filterBar}
          {summary}
        </div>
        <div className="flex-1 overflow-y-auto p-4">{list}</div>
      </aside>

      {/* Map */}
      <div className="relative flex-1">
        {hasMapsKey ? (
          <GoogleMap
            defaultCenter={initialCenter}
            defaultZoom={13}
            mapId={env.googleMapsMapId}
            gestureHandling="greedy"
            disableDefaultUI
            clickableIcons={false}
            reuseMaps
            className="size-full"
            onIdle={(e) => {
              const c = e.map.getCenter();
              const ne = e.map.getBounds()?.getNorthEast();
              if (c) void onCameraIdle({ lat: c.lat(), lng: c.lng() }, ne ? { lat: ne.lat(), lng: ne.lng() } : null);
            }}
          >
            <FlyTo target={flyTo} />
            {withDistance.map((g) => (
              <GameMarker key={g.id} game={g} nearest={g.id === nearestId} highlighted={highlight === g.id}
                onClick={openGame} onHover={setHighlight} />
            ))}
            {position && (
              <AdvancedMarker position={position} zIndex={2000} title="You">
                <UserDot />
              </AdvancedMarker>
            )}
          </GoogleMap>
        ) : (
          <SchematicMap games={withDistance} center={query.center} user={position} nearestId={nearestId}
            highlight={highlight} onOpen={openGame} onHover={setHighlight} />
        )}

        {/* Mobile list view replaces the map */}
        {mobileView === "list" && (
          <div className="absolute inset-0 z-10 overflow-y-auto bg-bg px-4 pb-40 pt-36 md:hidden">{list}</div>
        )}

        {/* Top overlay (mobile) */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 space-y-2 p-3 pt-[max(env(safe-area-inset-top),12px)] md:hidden">
          <div className="pointer-events-auto flex items-center gap-2">
            {hasMapsKey ? (
              <PlaceSearch label={label} onPick={(p, name) => { setFlyTo(p); setLabel(name); lastGeocoded.current = p; }} />
            ) : (
              <div className="flex h-12 flex-1 items-center rounded-2xl bg-surface px-4 font-semibold shadow-float">{label}</div>
            )}
            <Link href={userId ? "/requests" : "/sign-in?next=/requests"} aria-label={`Requests${pending ? `, ${pending} waiting` : ""}`}
              className="relative flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface shadow-float">
              <Bell className="size-5" />
              {pending > 0 && (
                <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-danger px-1 text-center text-[11px] font-bold leading-5 text-white">{pending}</span>
              )}
            </Link>
          </div>
          <div className="pointer-events-auto">{filterBar}</div>
        </div>

        {/* Desktop search */}
        {hasMapsKey && (
          <div className="absolute left-4 right-4 top-4 z-20 hidden max-w-md md:flex">
            <PlaceSearch label={label} onPick={(p, name) => { setFlyTo(p); setLabel(name); lastGeocoded.current = p; }} />
          </div>
        )}

        {/* Bottom overlay */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 space-y-2 p-3 md:p-4">
          <div className="flex items-end justify-between gap-2">
            <button type="button" onClick={() => setMobileView((v) => (v === "map" ? "list" : "map"))}
              className="pointer-events-auto flex h-11 items-center gap-2 rounded-full bg-surface px-4 text-sm font-semibold shadow-float md:hidden">
              {mobileView === "map" ? <><List className="size-4" /> List</> : <><MapIcon className="size-4" /> Map</>}
            </button>
            <button type="button" onClick={recenter} aria-label="Centre on me"
              className="pointer-events-auto ml-auto flex size-11 items-center justify-center rounded-full bg-surface shadow-float">
              {status === "locating" ? <Spinner /> : <LocateFixed className={clsx("size-5", status === "live" && "text-info")} />}
            </button>
          </div>
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-float md:ml-auto md:max-w-md">
            <div className="min-w-0 flex-1">
              {loading ? <span className="inline-flex items-center gap-2 text-sm text-muted"><Spinner /> Finding games…</span> : summary}
            </div>
            <Link href={userId ? "/host/new" : "/sign-in?next=/host/new"}
              className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-bold text-white shadow-card dark:text-[#052e1a]">
              <Plus className="size-4" /> Start a game
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function FlyTo({ target }: { target: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !target) return;
    map.panTo(target);
    if ((map.getZoom() ?? 13) < 13) map.setZoom(14);
  }, [map, target]);
  return null;
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={clsx("flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold shadow-card transition",
        on ? "border-brand bg-brand text-white dark:text-[#052e1a]" : "border-line bg-surface text-ink hover:bg-surface-2")}>
      {children}
    </button>
  );
}

