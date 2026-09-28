"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Live count of pending join requests to games the user hosts (the bell badge). */
export function usePendingRequests(userId: string | null, initial = 0) {
  const [count, setCount] = useState(initial);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    let cancelled = false;

    const refresh = async () => {
      const { count: c } = await supabase
        .from("join_requests")
        .select("id, games!inner(host_id)", { count: "exact", head: true })
        .eq("status", "pending")
        .eq("games.host_id", userId);
      if (!cancelled && typeof c === "number") setCount(c);
    };

    // RLS limits these events to requests the user can see (their own or to their games).
    const channel = supabase
      .channel(`pending-requests:${userId}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "join_requests" }, refresh)
      .subscribe();

    void refresh();
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return count;
}
