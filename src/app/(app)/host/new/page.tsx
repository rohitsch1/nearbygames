import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CreateGameForm } from "@/components/game/create-game-form";
import { MapsProvider } from "@/components/map/maps-provider";
import { PageHeader } from "@/components/ui/page-header";
import { canTransact } from "@/lib/profile";
import { createClient, getSession } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Start a game", robots: { index: false, follow: false } };

export default async function NewGamePage() {
  const session = await getSession();
  if (!session) redirect("/sign-in?next=/host/new");
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_home_location");
  const home = (data as { lat: number; lng: number }[] | null)?.[0] ?? null;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-32 md:px-8">
      <PageHeader title="Start a game" back="/map" subtitle="It shows up on the map for everyone nearby within seconds." />
      <MapsProvider>
        <CreateGameForm
          userId={session.userId}
          home={home}
          hasName={Boolean(session.profile?.full_name)}
          canCharge={canTransact(session.profile)}
          favouriteSports={session.profile?.sports ?? []}
        />
      </MapsProvider>
    </div>
  );
}
