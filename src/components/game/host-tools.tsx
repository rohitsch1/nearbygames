"use client";

import { UserX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cancelGame, setNoShow } from "@/app/actions/games";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { Participant } from "@/lib/queries";

interface Props { gameId: string; started: boolean; cancelled: boolean; players: Participant[] }

export function HostTools({ gameId, started, cancelled, players }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const toggleNoShow = (userId: string, value: boolean) =>
    startTransition(async () => {
      const res = await setNoShow(gameId, userId, value);
      if (!res.ok) return void toast.error(res.error);
      router.refresh();
    });

  const cancel = () =>
    startTransition(async () => {
      const res = await cancelGame(gameId);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Game cancelled. Players have been notified and refunded.");
      setConfirming(false);
      router.refresh();
    });

  return (
    <section className="space-y-4 rounded-2xl border border-line bg-surface p-4">
      <h3 className="font-bold">Host tools</h3>

      {players.length > 0 && (
        <div>
          <p className="mb-2 text-sm text-muted">{started ? "Mark anyone who didn't turn up. It shows on their profile to future hosts." : "Your squad so far"}</p>
          <ul className="divide-y divide-line">
            {players.map((p) => (
              <li key={p.user_id} className="flex items-center gap-3 py-2">
                <Avatar name={p.profile.full_name} src={p.profile.avatar_url} size={36} />
                <span className="min-w-0 flex-1 truncate font-semibold">{p.profile.full_name ?? "Guest player"}</span>
                {started && (
                  <Button size="sm" variant={p.no_show ? "danger" : "outline"} disabled={pending}
                    onClick={() => toggleNoShow(p.user_id, !p.no_show)} icon={<UserX className="size-4" />}>
                    {p.no_show ? "No-show" : "Mark no-show"}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!cancelled && !started && (
        confirming ? (
          <div className="rounded-xl bg-danger-soft p-3">
            <p className="text-sm font-semibold text-danger">Cancel this game? Everyone in it is notified and paid players are refunded to their wallet.</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>Keep it</Button>
              <Button size="sm" variant="danger" loading={pending} onClick={cancel}>Yes, cancel game</Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" size="sm" className="text-danger" onClick={() => setConfirming(true)}>Cancel game</Button>
        )
      )}
    </section>
  );
}
