"use client";

import { CheckCircle2, Clock, Lock, MessageCircle, Users, XCircle, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { requestToJoin, withdrawRequest } from "@/app/actions/games";
import { Button, LinkButton } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import type { ViewerState } from "@/lib/queries";

interface Props {
  gameId: string;
  slug: string;
  state: ViewerState;
  hostName: string;
  isPaid: boolean;
  priceLabel: string | null;
  pendingCount: number;
}

/**
 * The bottom of the game page. Exactly one of six states (plus edge cases),
 * mirroring the DB rules: free = request, paid = transaction.
 */
export function GameActions({ gameId, slug, state, hostName, isPaid, priceLabel, pendingCount }: Props) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  const ask = () =>
    startTransition(async () => {
      const res = await requestToJoin(gameId, note);
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Request sent to ${hostName}`);
      setNote("");
      router.refresh();
    });

  const withdraw = (requestId: string) =>
    startTransition(async () => {
      const res = await withdrawRequest(requestId);
      if (!res.ok) return void toast.error(res.error);
      toast("Request withdrawn");
      router.refresh();
    });

  let body: React.ReactNode;
  switch (state.kind) {
    case "host":
      body = (
        <>
          <Status icon={<Users className="size-5" />} tone="brand" title="This is your game"
            text={isPaid ? "Players pay to join — no approvals needed." : pendingCount ? `${pendingCount} request${pendingCount === 1 ? "" : "s"} waiting for you.` : "No new requests right now."} />
          {!isPaid && <LinkButton href={`/requests?game=${gameId}`} size="lg" className="w-full">See who&apos;s asked to join{pendingCount ? ` (${pendingCount})` : ""}</LinkButton>}
          {isPaid && <LinkButton href="/messages" size="lg" variant="secondary" className="w-full">Chat with players</LinkButton>}
        </>
      );
      break;
    case "in":
      body = (
        <>
          <Status icon={<CheckCircle2 className="size-5" />} tone="brand" title="You're in!" text={`See you there. ${hostName} can see you in the squad.`} />
          {state.conversationId && (
            <LinkButton href={`/messages/${state.conversationId}`} size="lg" className="w-full" icon={<MessageCircle className="size-5" />}>
              Chat with {hostName}
            </LinkButton>
          )}
        </>
      );
      break;
    case "full":
      body = <Status icon={<Users className="size-5" />} tone="neutral" title="This game is full" text="Every spot is taken. Check the map for another game nearby." />;
      break;
    case "paid-open":
      body = state.canTransact ? (
        <>
          <p className="text-sm text-muted">Pay your share and you&apos;re in instantly — no waiting for approval.</p>
          <LinkButton href={`/games/${slug}/pay`} variant="paid" size="lg" className="w-full" icon={<Zap className="size-5" />}>
            Pay {priceLabel} and join instantly
          </LinkButton>
        </>
      ) : (
        <>
          <Status icon={<Lock className="size-5" />} tone="paid" title="Complete your profile to pay"
            text="Paid games need your name, area, occupation and ID check. Takes a minute." />
          <LinkButton href={`/me/edit?next=${encodeURIComponent(`/games/${slug}/pay`)}`} variant="paid" size="lg" className="w-full">
            Complete profile
          </LinkButton>
        </>
      );
      break;
    case "requested":
      body = (
        <>
          <Status icon={<Clock className="size-5" />} tone="info" title="Request sent" text={`You'll get a ping when ${hostName} responds.`} />
          <Button variant="outline" size="lg" className="w-full" loading={pending} onClick={() => withdraw(state.requestId)}>Withdraw request</Button>
        </>
      );
      break;
    case "declined":
      body = <Status icon={<XCircle className="size-5" />} tone="neutral" title={`${hostName} couldn't fit you in`} text={state.reason ?? "Try another game nearby — there's always one on the map."} />;
      break;
    case "free-open":
      body = (
        <>
          <label htmlFor="note" className="text-sm font-semibold">Note for {hostName} <span className="font-normal text-subtle">(optional)</span></label>
          <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={280} rows={2}
            placeholder="Can I bring a friend?" className="min-h-16" />
          <Button size="lg" className="w-full" loading={pending} onClick={ask}>Ask to join</Button>
          <p className="text-center text-xs text-subtle">Free game — {hostName} approves each player.</p>
        </>
      );
      break;
    case "signed-out":
      body = (
        <>
          <p className="text-sm text-muted">{isPaid ? "Sign in to pay your share and join instantly." : `Sign in to ask ${hostName} if you can join.`}</p>
          <LinkButton href={`/sign-in?next=${encodeURIComponent(`/games/${slug}`)}`} variant={isPaid ? "paid" : "primary"} size="lg" className="w-full">
            {isPaid ? `Sign in to join · ${priceLabel}` : "Sign in to ask to join"}
          </LinkButton>
        </>
      );
      break;
    case "cancelled":
      body = <Status icon={<XCircle className="size-5" />} tone="danger" title="This game was cancelled" text="Any payments were refunded to players' wallets." />;
      break;
    case "ended":
      body = <Status icon={<Clock className="size-5" />} tone="neutral" title="This game has finished" text="Find the next one on the map." />;
      break;
  }

  return (
    <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-line bg-surface/95 p-4 backdrop-blur md:bottom-0 md:left-20 lg:static lg:rounded-3xl lg:border lg:bg-surface lg:p-5 lg:shadow-card lg:backdrop-blur-none">
      <div className="mx-auto max-w-2xl space-y-3">
        {priceLabel && state.kind !== "in" && state.kind !== "host" && (
          <p className="hidden items-baseline justify-between lg:flex">
            <span className="text-sm text-muted">Your share incl. fee</span>
            <span className="text-2xl font-extrabold">{priceLabel}</span>
          </p>
        )}
        {body}
        {(state.kind === "full" || state.kind === "ended" || state.kind === "declined") && (
          <Link href="/map" className="block text-center text-sm font-semibold text-brand-strong">Find another game →</Link>
        )}
      </div>
    </div>
  );
}

function Status({ icon, tone, title, text }: { icon: React.ReactNode; tone: "brand" | "info" | "paid" | "neutral" | "danger"; title: string; text: string }) {
  const tones = {
    brand: "bg-brand-soft text-brand-strong",
    info: "bg-info-soft text-info",
    paid: "bg-paid-soft text-paid-strong",
    neutral: "bg-surface-2 text-muted",
    danger: "bg-danger-soft text-danger",
  };
  return (
    <div className="flex items-start gap-3">
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>{icon}</span>
      <div>
        <p className="font-bold">{title}</p>
        <p className="text-sm text-muted">{text}</p>
      </div>
    </div>
  );
}
