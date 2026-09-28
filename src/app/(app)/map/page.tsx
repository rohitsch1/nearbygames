import type { Metadata } from "next";
import { GameMap } from "@/components/map/game-map";
import { createClient, getSession } from "@/lib/supabase/server";
import type { LatLng } from "@/lib/geo";

export const metadata: Metadata = {
  title: "Games near you",
  description: "A live map of every pickup game happening near you right now — football, cricket, badminton, chess and more.",
  alternates: { canonical: "/map" },
};

export default async function MapPage() {
  const session = await getSession();
  let home: LatLng | null = null;
  if (session) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("my_home_location");
    const row = (data as { lat: number; lng: number }[] | null)?.[0];
    if (row) home = { lat: row.lat, lng: row.lng };
  }
  return (
    <>
      <h1 className="sr-only">Pickup games near you</h1>
      <GameMap
        userId={session?.userId ?? null}
        home={home}
        areaName={session?.profile?.area_name ?? null}
        favouriteSports={session?.profile?.sports ?? []}
      />
    </>
  );
}
