"use client";

import { Clock, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { withdrawRequest } from "@/app/actions/games";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { SportIcon } from "@/components/ui/sport-icon";
import { firstName, formatWhen, timeAgo } from "@/lib/format";
import type { RequestStatus, Sport } from "@/lib/types";

export interface MyRequestRow {
  id: string;
  status: RequestStatus;
  note: string | null;
  decline_reason: string | null;
  created_at: string;
  game: { id: string; slug: string; sport: Sport; spot_name: string; starts_at: string; host: { full_name: string | null; avatar_url: string | null } };
  conversationId?: string | null;
}

export function MyRequestCard({ request: r }: { request: MyRequestRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const host = firstName(r.game.host.full_name, "the host");

  const withdraw = () =>
    startTransition(async () => {
      const res = await withdrawRequest(r.id);
      if (!res.ok) return void toast.error(res.error);
      router.refresh();
    });

  return (
    <article className="rounded-2xl border border-line bg-surface p-4">
      <Link href={`/games/${r.game.slug}`} className="flex items-center gap-3">
        <SportIcon sport={r.game.sport} size={48} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{r.game.spot_name}</p>
          <p className="truncate text-sm text-muted">{formatWhen(r.game.starts_at)} · hosted by {host}</p>
        </div>
        {r.status === "pending" && <Badge tone="info"><Clock className="size-3" /> Waiting</Badge>}
        {r.status === "accepted" && <Badge tone="brand">Accepted</Badge>}
        {r.status === "declined" && <Badge tone="danger">Declined</Badge>}
      </Link>

      {r.status === "pending" && (
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
          <p className="text-sm text-muted" suppressHydrationWarning>Sent {timeAgo(r.created_at)} ago · waiting on {host}</p>
          <Button size="sm" variant="ghost" loading={pending} onClick={withdraw}>Withdraw</Button>
        </div>
      )}
      {r.status === "pending" && r.conversationId && (
        <LinkButton href={`/messages/${r.conversationId}`} size="sm" variant="secondary" className="mt-2 w-full" icon={<MessageCircle className="size-4" />}>
          Chat with {host}
        </LinkButton>
      )}
      {r.status === "accepted" && r.conversationId && (
        <LinkButton href={`/messages/${r.conversationId}`} size="sm" className="mt-3 w-full" icon={<MessageCircle className="size-4" />}>
          Open chat with {host}
        </LinkButton>
      )}
      {r.status === "declined" && r.decline_reason && (
        <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted">“{r.decline_reason}” — {host}</p>
      )}
    </article>
  );
}
