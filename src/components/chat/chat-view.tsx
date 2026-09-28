"use client";

import { clsx } from "clsx";
import { AlertCircle, ChevronLeft, SendHorizontal } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { APP_TIMEZONE, formatWhen } from "@/lib/format";
import { SPORT_BY_ID } from "@/lib/sports";
import { createClient } from "@/lib/supabase/client";
import type { Message, Sport } from "@/lib/types";

type Person = { id: string; full_name: string | null; avatar_url: string | null };
type LocalMessage = Message & { pending?: boolean; failed?: boolean };

interface Props {
  conversationId: string;
  me: string;
  other: Person;
  otherRole: "host" | "player";
  game: { slug: string; sport: Sport; spot_name: string; starts_at: string; status: string };
  initialMessages: Message[];
}

const timeFmt = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: APP_TIMEZONE });
const dayFmt = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "short", timeZone: APP_TIMEZONE });
const dayKey = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE }).format(new Date(iso));

export function ChatView({ conversationId, me, other, otherRole, game, initialMessages }: Props) {
  const [messages, setMessages] = useState<LocalMessage[]>(initialMessages);
  const [text, setText] = useState("");
  const [hasMore, setHasMore] = useState(initialMessages.length === 50);
  const [loadingMore, setLoadingMore] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Merge a server row into state, replacing its optimistic twin (matched by client_id).
  const upsert = useCallback((row: Message) => {
    setMessages((cur) => {
      if (cur.some((m) => m.id === row.id)) return cur;
      const i = row.client_id ? cur.findIndex((m) => m.client_id === row.client_id) : -1;
      if (i >= 0) {
        const copy = [...cur];
        copy[i] = row;
        return copy;
      }
      return [...cur, row];
    });
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          upsert(payload.new as Message);
          // Opened chat = read: clear the message ping for this conversation.
          if ((payload.new as Message).sender_id !== me) {
            void supabase.from("notifications").update({ read_at: new Date().toISOString() })
              .eq("user_id", me).eq("kind", "message").eq("link", `/messages/${conversationId}`).is("read_at", null);
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, me, upsert]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send(body: string, clientId = crypto.randomUUID()) {
    const trimmed = body.trim();
    if (!trimmed) return;
    stickToBottom.current = true;
    const optimistic: LocalMessage = {
      id: `local-${clientId}`, conversation_id: conversationId, sender_id: me, body: trimmed,
      client_id: clientId, created_at: new Date().toISOString(), pending: true,
    };
    setMessages((cur) => [...cur.filter((m) => m.client_id !== clientId), optimistic]);
    const { data, error } = await createClient()
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: me, body: trimmed, client_id: clientId })
      .select()
      .single();
    if (error) {
      // Unique violation on client_id means it actually landed (e.g. retry) — realtime will deliver it.
      if (error.code === "23505") return;
      setMessages((cur) => cur.map((m) => (m.client_id === clientId ? { ...m, pending: false, failed: true } : m)));
      return;
    }
    upsert(data as Message);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = text;
    setText("");
    void send(body);
    inputRef.current?.focus();
  }

  async function loadEarlier() {
    const oldest = messages.find((m) => !m.pending);
    if (!oldest) return;
    setLoadingMore(true);
    const el = scroller.current;
    const prevHeight = el?.scrollHeight ?? 0;
    const { data } = await createClient()
      .from("messages").select("*").eq("conversation_id", conversationId)
      .lt("created_at", oldest.created_at).order("created_at", { ascending: false }).limit(50);
    const older = ((data ?? []) as Message[]).reverse();
    stickToBottom.current = false;
    setMessages((cur) => [...older.filter((o) => !cur.some((c) => c.id === o.id)), ...cur]);
    setHasMore(older.length === 50);
    setLoadingMore(false);
    requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - prevHeight; });
  }

  const sport = SPORT_BY_ID[game.sport];

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center gap-3 border-b border-line bg-surface px-3 py-2.5 pt-[max(env(safe-area-inset-top),10px)] md:px-6">
        <Link href="/messages" aria-label="Back to messages" className="flex size-9 items-center justify-center rounded-full hover:bg-surface-2">
          <ChevronLeft className="size-5" />
        </Link>
        <Avatar name={other.full_name} src={other.avatar_url} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{other.full_name ?? "Player"}</p>
          <p className="truncate text-xs text-muted">{otherRole === "host" ? "Host" : "Player"}</p>
        </div>
      </header>

      <Link href={`/games/${game.slug}`} className="flex items-center gap-2 border-b border-line bg-brand-soft px-4 py-2 text-sm text-brand-strong md:px-6">
        <span aria-hidden>{sport.emoji}</span>
        <span className="truncate font-semibold">{game.spot_name} · {formatWhen(game.starts_at)}</span>
        {game.status === "cancelled" && <span className="ml-auto shrink-0 font-bold text-danger">Cancelled</span>}
      </Link>

      <div ref={scroller} className="flex-1 overflow-y-auto px-3 py-4 md:px-6"
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        role="log" aria-live="polite" aria-label="Messages">
        <div className="mx-auto max-w-3xl space-y-1">
          {hasMore && (
            <div className="flex justify-center pb-3">
              <button type="button" onClick={loadEarlier} disabled={loadingMore} className="rounded-full bg-surface-2 px-4 py-1.5 text-xs font-semibold text-muted">
                {loadingMore ? <Spinner /> : "Load earlier messages"}
              </button>
            </div>
          )}
          {messages.length === 0 && (
            <p className="py-10 text-center text-sm text-muted">You&apos;re both in. Say hi and sort out the details 👋</p>
          )}
          {messages.map((m, i) => {
            const mine = m.sender_id === me;
            const prev = messages[i - 1];
            const newDay = !prev || dayKey(prev.created_at) !== dayKey(m.created_at);
            const grouped = prev && !newDay && prev.sender_id === m.sender_id;
            return (
              <div key={m.client_id ?? m.id}>
                {newDay && <p className="py-3 text-center text-xs font-semibold text-subtle">{dayFmt.format(new Date(m.created_at))}</p>}
                <div className={clsx("flex", mine ? "justify-end" : "justify-start", !grouped && "pt-2")}>
                  <div className={clsx("max-w-[80%] rounded-2xl px-3.5 py-2 text-[15px] leading-snug shadow-card md:max-w-[65%]",
                    mine ? "rounded-br-md bg-brand text-white dark:text-[#052e1a]" : "rounded-bl-md bg-surface",
                    m.failed && "bg-danger-soft text-danger")}>
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p className={clsx("mt-0.5 text-right text-[10px]", mine ? "text-white/75 dark:text-[#052e1a]/70" : "text-subtle")}>
                      {m.pending ? "Sending…" : m.failed ? "" : timeFmt.format(new Date(m.created_at))}
                    </p>
                  </div>
                </div>
                {m.failed && (
                  <button type="button" onClick={() => send(m.body, m.client_id!)} className="ml-auto mt-1 flex items-center gap-1 text-xs font-semibold text-danger">
                    <AlertCircle className="size-3.5" /> Not sent — tap to retry
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <form onSubmit={onSubmit} className="pb-safe border-t border-line bg-surface px-3 py-2 md:px-6">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <label htmlFor="msg" className="sr-only">Message</label>
          <textarea id="msg" ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} rows={1} maxLength={2000}
            placeholder="Message" enterKeyHint="send"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); onSubmit(e); } }}
            className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-line bg-surface-2 px-4 py-2.5 text-[15px] outline-none focus:border-brand" />
          <button type="submit" disabled={!text.trim()} aria-label="Send"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-white transition disabled:opacity-40 dark:text-[#052e1a]">
            <SendHorizontal className="size-5" />
          </button>
        </div>
      </form>
    </div>
  );
}
