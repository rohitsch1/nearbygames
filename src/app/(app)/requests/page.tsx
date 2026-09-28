import { clsx } from "clsx";
import { Inbox, Send } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { HostRequestCard } from "@/components/game/host-request-card";
import { MyRequestCard, type MyRequestRow } from "@/components/game/my-request-card";
import { EmptyState } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { createClient, getSession } from "@/lib/supabase/server";
import type { HostRequestRow } from "@/lib/types";

export const metadata: Metadata = { title: "Requests", robots: { index: false, follow: false } };

export default async function RequestsPage({ searchParams }: PageProps<"/requests">) {
  const session = await getSession();
  if (!session) redirect("/sign-in?next=/requests");
  const sp = await searchParams;
  const gameFilter = typeof sp.game === "string" ? sp.game : null;
  const supabase = await createClient();

  const [{ data: hostRows }, { data: mine }, { data: convs }] = await Promise.all([
    supabase.rpc("host_requests"),
    supabase
      .from("join_requests")
      .select("id, status, note, decline_reason, created_at, game:games(id, slug, sport, spot_name, starts_at, host:profiles!games_host_id_fkey(full_name, avatar_url))")
      .eq("requester_id", session.userId)
      .neq("status", "withdrawn")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("conversations").select("id, game_id").eq("player_id", session.userId),
  ]);

  let hosting = (hostRows ?? []) as HostRequestRow[];
  if (gameFilter) hosting = hosting.filter((r) => r.game_id === gameFilter);
  const convByGame = new Map((convs ?? []).map((c) => [c.game_id as string, c.id as string]));
  const myRequests = ((mine ?? []) as unknown as MyRequestRow[]).map((r) => ({ ...r, conversationId: convByGame.get(r.game.id) ?? null }));

  const pendingHosting = hosting.filter((r) => r.status === "pending").length;
  const tab = sp.tab === "mine" || sp.tab === "hosting" ? sp.tab : pendingHosting > 0 || myRequests.length === 0 ? "hosting" : "mine";

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 md:px-8">
      <PageHeader title="Requests" />

      <div role="tablist" className="mb-5 grid grid-cols-2 rounded-2xl bg-surface-2 p-1">
        <TabLink href="/requests?tab=hosting" active={tab === "hosting"} count={pendingHosting}>To your games</TabLink>
        <TabLink href="/requests?tab=mine" active={tab === "mine"} count={myRequests.filter((r) => r.status === "pending").length} muted>You asked to join</TabLink>
      </div>

      {tab === "hosting" ? (
        hosting.length === 0 ? (
          <EmptyState icon={<Inbox className="size-6" />} title={gameFilter ? "No requests for this game yet" : "No requests yet"}
            body="When someone asks to join a free game you're hosting, they'll show up here."
            action={<LinkButton href="/host/new">Start a game</LinkButton>} />
        ) : (
          <div className="space-y-3">
            {gameFilter && <Link href="/requests?tab=hosting" className="text-sm font-semibold text-brand-strong">← All your games</Link>}
            {hosting.map((r) => <HostRequestCard key={r.id} request={r} />)}
          </div>
        )
      ) : myRequests.length === 0 ? (
        <EmptyState icon={<Send className="size-6" />} title="You haven't asked to join anything yet"
          body="Find a free game on the map and tap “Ask to join”." action={<LinkButton href="/map">Open the map</LinkButton>} />
      ) : (
        <div className="space-y-3">{myRequests.map((r) => <MyRequestCard key={r.id} request={r} />)}</div>
      )}
    </div>
  );
}

function TabLink({ href, active, count, muted, children }: { href: string; active: boolean; count: number; muted?: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} role="tab" aria-selected={active} replace
      className={clsx("flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition",
        active ? "bg-surface text-ink shadow-card" : "text-muted")}>
      {children}
      {count > 0 && (
        <span className={clsx("min-w-5 rounded-full px-1.5 text-center text-[11px] font-bold leading-5", muted ? "bg-line text-muted" : "bg-danger text-white")}>{count}</span>
      )}
    </Link>
  );
}
