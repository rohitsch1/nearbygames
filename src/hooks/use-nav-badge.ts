"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type BadgeKind = "messages" | "requests";

const SECTION: Record<BadgeKind, RegExp> = {
  messages: /^\/messages/,
  requests: /^\/requests/,
};

// "Seen up to" is the created_at of the newest item the user has seen (server time, so the
// phone's clock can't hide or resurrect anything). Kept per device, per user.
const seenKey = (kind: BadgeKind, userId: string) => `ng:seen:${kind}:${userId}`;
function readSeen(kind: BadgeKind, userId: string) {
  try { return localStorage.getItem(seenKey(kind, userId)); } catch { return null; }
}
function writeSeen(kind: BadgeKind, userId: string, iso: string) {
  try { localStorage.setItem(seenKey(kind, userId), iso); } catch { /* private mode */ }
}

/**
 * Live count for a nav icon: new chat messages, or new join requests to games you host,
 * that arrived since you last opened that tab. Opening the tab (or tapping the icon) clears it.
 * Returns the count and a `markSeen` to call from the icon's onClick for instant feedback.
 */
export function useNavBadge(userId: string | null, kind: BadgeKind) {
  const pathname = usePathname();
  const [count, setCount] = useState(0);
  const newest = useRef<string | null>(null);
  const onSection = SECTION[kind].test(pathname);
  const onSectionRef = useRef(onSection);
  const refreshRef = useRef<(() => Promise<void>) | null>(null);
  useEffect(() => { onSectionRef.current = onSection; });

  const markSeen = useCallback(() => {
    if (!userId) return;
    if (newest.current) writeSeen(kind, userId, newest.current);
    setCount(0);
  }, [userId, kind]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    let cancelled = false;

    const refresh = async () => {
      const seen = readSeen(kind, userId);
      let q = kind === "messages"
        ? supabase.from("notifications").select("created_at")
            .eq("user_id", userId).eq("kind", "message").is("read_at", null)
        : supabase.from("join_requests").select("created_at, games!inner(host_id)")
            .eq("status", "pending").eq("games.host_id", userId);
      if (seen) q = q.gt("created_at", seen);
      const { data } = await q.order("created_at", { ascending: false }).limit(100);
      if (cancelled || !data) return;
      newest.current = (data[0]?.created_at as string | undefined) ?? newest.current;
      // Already looking at this tab: whatever just arrived counts as seen.
      if (onSectionRef.current) return markSeen();
      setCount(data.length);
    };

    refreshRef.current = refresh;
    const table = kind === "messages" ? "notifications" : "join_requests";
    const channel = supabase
      .channel(`badge:${kind}:${userId}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes",
        kind === "messages"
          ? { event: "*", schema: "public", table, filter: `user_id=eq.${userId}` }
          // RLS limits these events to requests the user can see (their own or to their games).
          : { event: "*", schema: "public", table },
        () => void refresh())
      .subscribe();

    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      refreshRef.current = null;
      window.removeEventListener("focus", onFocus);
      supabase.removeChannel(channel);
    };
  }, [userId, kind, markSeen]);

  // Entering the tab (from the icon, a toast or a link) re-checks, which records everything as seen.
  useEffect(() => { if (onSection) void refreshRef.current?.(); }, [onSection]);

  return { count: onSection ? 0 : count, markSeen };
}
