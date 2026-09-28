"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

interface NotificationRow {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
}

/**
 * Realtime in-app "pings": shows a toast for new notifications and, when the tab
 * is in the background and permission was granted, a system notification.
 */
export function NotificationListener({ userId }: { userId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as NotificationRow;
          // Don't toast chat messages for the conversation already on screen.
          if (n.kind === "message" && n.link && window.location.pathname === n.link) return;

          if (document.visibilityState === "hidden" && "Notification" in window && Notification.permission === "granted") {
            const sys = new Notification(n.title, { body: n.body ?? undefined, icon: "/icons/icon-192.png", tag: n.id });
            sys.onclick = () => { window.focus(); if (n.link) router.push(n.link); };
          } else {
            toast(n.title, {
              description: n.body ?? undefined,
              action: n.link ? { label: "Open", onClick: () => router.push(n.link!) } : undefined,
            });
          }
          if (n.kind !== "message") router.refresh();
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, router]);

  return null;
}
