import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ChatView } from "@/components/chat/chat-view";
import { createClient, getSession } from "@/lib/supabase/server";
import type { ConversationStatus, Message, Sport } from "@/lib/types";

export const metadata: Metadata = { title: "Chat", robots: { index: false, follow: false } };

type Person = { id: string; full_name: string | null; avatar_url: string | null };

export default async function ConversationPage({ params }: PageProps<"/messages/[id]">) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/sign-in?next=/messages/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data: conv } = await supabase
    .from("conversations")
    .select("id, host_id, player_id, game:games(slug, sport, spot_name, starts_at, status), host:profiles!conversations_host_id_fkey(id, full_name, avatar_url), player:profiles!conversations_player_id_fkey(id, full_name, avatar_url)")
    .eq("id", id)
    .maybeSingle();
  // RLS returns nothing for chats you're not in — same response as "doesn't exist".
  if (!conv) notFound();

  const c = conv as unknown as {
    id: string; host_id: string; player_id: string;
    game: { slug: string; sport: Sport; spot_name: string; starts_at: string; status: string };
    host: Person; player: Person;
  };

  const [{ data: msgs }, { data: status }] = await Promise.all([
    supabase.from("messages").select("*").eq("conversation_id", id).order("created_at", { ascending: false }).limit(50),
    supabase.rpc("conversation_status", { p_conv: id }),
    supabase.from("notifications").update({ read_at: new Date().toISOString() })
      .eq("user_id", session.userId).eq("kind", "message").eq("link", `/messages/${id}`).is("read_at", null),
  ]);

  const iAmHost = c.host_id === session.userId;
  return (
    <ChatView
      conversationId={c.id}
      me={session.userId}
      other={iAmHost ? c.player : c.host}
      otherRole={iAmHost ? "player" : "host"}
      status={(status as ConversationStatus | null) ?? "closed"}
      game={c.game}
      initialMessages={((msgs ?? []) as Message[]).reverse()}
    />
  );
}
