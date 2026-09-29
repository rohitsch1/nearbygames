"use client";

import { Check, MapPin, MessageCircle, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { acceptRequest, declineRequest, openRequestChat } from "@/app/actions/games";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { RatingSummary } from "@/components/ui/rating";
import { VerifiedTick } from "@/components/ui/verified-tick";
import { formatWhen, timeAgo } from "@/lib/format";
import { SPORT_BY_ID } from "@/lib/sports";
import type { HostRequestRow } from "@/lib/types";

export function reliability(gamesPlayed: number, noShows: number) {
  if (noShows > 0) return { tone: "danger" as const, label: `Flaked ${noShows}×` };
  if (gamesPlayed >= 3) return { tone: "brand" as const, label: `Regular · ${gamesPlayed} games` };
  return { tone: "info" as const, label: gamesPlayed ? `New · ${gamesPlayed} game${gamesPlayed === 1 ? "" : "s"}` : "New player" };
}

export function HostRequestCard({ request: r }: { request: HostRequestRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const rel = reliability(r.games_played, r.no_shows);

  const accept = () =>
    startTransition(async () => {
      const res = await acceptRequest(r.id);
      if (!res.ok) return void toast.error(res.error);
      toast.success(`${r.full_name?.split(" ")[0] ?? "Player"} is in. Chat opened.`);
      router.push(`/messages/${res.data!.conversationId}`);
    });

  const chat = () =>
    startTransition(async () => {
      const res = await openRequestChat(r.id);
      if (!res.ok) return void toast.error(res.error);
      router.push(`/messages/${res.data!.conversationId}`);
    });

  const decline = () =>
    startTransition(async () => {
      const res = await declineRequest(r.id, reason);
      if (!res.ok) return void toast.error(res.error);
      toast("Request declined");
      setDeclining(false);
      router.refresh();
    });

  return (
    <article className="rounded-2xl border border-line bg-surface p-4 animate-fade-up">
      <Link href={`/games/${r.game_slug}`} className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted hover:text-ink">
        <span aria-hidden>{SPORT_BY_ID[r.sport].emoji}</span>
        <span className="truncate">{r.spot_name} · {formatWhen(r.starts_at)}</span>
      </Link>
      <div className="flex items-start gap-3">
        <Avatar name={r.full_name} src={r.avatar_url} size={52} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="flex items-center gap-1.5 font-bold">
              {r.full_name ?? "Guest player"}
              {r.id_verified && <VerifiedTick />}
            </p>
            <Badge tone={rel.tone}>{rel.label}</Badge>
          </div>
          <RatingSummary avg={r.rating_avg} count={r.rating_count} className="mt-0.5" />
          <p className="mt-0.5 flex items-center gap-1 text-sm text-muted">
            <MapPin className="size-3.5" />
            {r.distance_band ? `Lives ${r.distance_band} away` : r.area_name ?? "Area not shared"}
            {r.distance_band && r.area_name && <> · {r.area_name}</>}
          </p>
          {r.note && <p className="mt-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">“{r.note}”</p>}
          <p className="mt-2 text-xs text-subtle" suppressHydrationWarning>Asked {timeAgo(r.created_at)} ago</p>
        </div>
      </div>

      {r.status === "pending" ? (
        declining ? (
          <div className="mt-4 space-y-2">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="Short reason (optional) — e.g. we're full on keepers" autoFocus />
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setDeclining(false)}>Back</Button>
              <Button variant="danger" className="flex-1" loading={pending} onClick={decline}>Decline</Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Button variant="outline" onClick={() => setDeclining(true)} disabled={pending} icon={<X className="size-4" />}>Decline</Button>
            <Button variant="secondary" onClick={chat} disabled={pending} icon={<MessageCircle className="size-4" />}>
              {r.conversation_id ? "Chat" : "Message"}
            </Button>
            <Button onClick={accept} loading={pending} icon={<Check className="size-4" />}>Accept</Button>
          </div>
        )
      ) : (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-muted">
            {r.status === "accepted" ? "✓ Accepted" : r.status === "declined" ? "Declined" : "Withdrawn by player"}
          </p>
          {r.conversation_id && (
            <LinkButton href={`/messages/${r.conversation_id}`} size="sm" variant="ghost" icon={<MessageCircle className="size-4" />}>
              {r.status === "accepted" ? "Chat" : "View chat"}
            </LinkButton>
          )}
        </div>
      )}
    </article>
  );
}
