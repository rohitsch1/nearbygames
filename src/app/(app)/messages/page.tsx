import { Lock, MessagesSquare } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { firstName, formatWhen, timeAgo } from "@/lib/format";
import { SPORT_BY_ID } from "@/lib/sports";
import { createClient, getSession } from "@/lib/supabase/server";
import type { Sport } from "@/lib/types";

export const metadata: Metadata = { title: "Messages", robots: { index: false, follow: false } };

type Person = { id: string; full_name: string | null; avatar_url: string | null };
interface ConvRow {
  id: string;
  host_id: string;
  last_message: string | null;
  last_message_at: string;
  game: { slug: string; sport: Sport; spot_name: string; starts_at: string };
  host: Person;
  player: Person;
}
interface PendingRow { id: string; game: { slug: string; sport: Sport; spot_name: string; starts_at: string; host: { full_name: string | null } } }

export default async function MessagesPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in?next=/messages");
  const supabase = await createClient();

  const [{ data: convs }, { data: pending }, { data: unread }] = await Promise.all([
    supabase
      .from("conversations")
      .select("id, host_id, last_message, last_message_at, game:games(slug, sport, spot_name, starts_at), host:profiles!conversations_host_id_fkey(id, full_name, avatar_url), player:profiles!conversations_player_id_fkey(id, full_name, avatar_url)")
      .order("last_message_at", { ascending: false })
      .limit(100),
    supabase
      .from("join_requests")
      .select("id, game:games(slug, sport, spot_name, starts_at, host:profiles!games_host_id_fkey(full_name))")
      .eq("requester_id", session.userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase.from("notifications").select("link").eq("kind", "message").is("read_at", null).limit(500),
  ]);

  const unreadBy = new Map<string, number>();
  (unread ?? []).forEach((n) => n.link && unreadBy.set(n.link as string, (unreadBy.get(n.link as string) ?? 0) + 1));
  const conversations = (convs ?? []) as unknown as ConvRow[];
  const locked = (pending ?? []) as unknown as PendingRow[];

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 md:px-8">
      <PageHeader title="Messages" />
      {conversations.length === 0 && locked.length === 0 ? (
        <EmptyState icon={<MessagesSquare className="size-6" />} title="No conversations yet"
          body="A chat with the host opens the moment you're accepted into a game, or pay into a paid one."
          action={<LinkButton href="/map">Find a game</LinkButton>} />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {conversations.map((c) => {
            const iAmHost = c.host_id === session.userId;
            const other = iAmHost ? c.player : c.host;
            const count = unreadBy.get(`/messages/${c.id}`) ?? 0;
            return (
              <li key={c.id}>
                <Link href={`/messages/${c.id}`} className="flex items-center gap-3 p-4 hover:bg-surface-2">
                  <div className="relative">
                    <Avatar name={other.full_name} src={other.avatar_url} size={48} />
                    <span className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full bg-surface text-sm shadow-card" aria-hidden>
                      {SPORT_BY_ID[c.game.sport].emoji}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate font-bold">{other.full_name ?? "Player"}</p>
                      <span className="shrink-0 text-xs text-subtle">{timeAgo(c.last_message_at)}</span>
                    </div>
                    <p className="truncate text-xs font-semibold text-muted">{c.game.spot_name} · {formatWhen(c.game.starts_at)}{iAmHost ? " · you're hosting" : ""}</p>
                    <div className="flex items-center gap-2">
                      <p className={`min-w-0 flex-1 truncate text-sm ${count ? "font-semibold text-ink" : "text-muted"}`}>
                        {c.last_message ?? "Say hi 👋"}
                      </p>
                      {count > 0 && <span className="min-w-5 rounded-full bg-brand px-1.5 text-center text-[11px] font-bold leading-5 text-white">{count}</span>}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
          {locked.map((r) => (
            <li key={r.id}>
              <Link href={`/games/${r.game.slug}`} className="flex items-center gap-3 p-4 opacity-70 hover:bg-surface-2">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted">
                  <Lock className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{r.game.spot_name}</p>
                  <p className="truncate text-sm text-muted">Locked until {firstName(r.game.host.full_name, "the host")} accepts your request</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
