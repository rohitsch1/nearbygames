import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PayForm } from "@/components/game/pay-form";
import { PageHeader } from "@/components/ui/page-header";
import { SportIcon } from "@/components/ui/sport-icon";
import { formatWhen } from "@/lib/format";
import { platformFee } from "@/lib/money";
import { canTransact } from "@/lib/profile";
import { getGameBySlug, getViewerState } from "@/lib/queries";
import { isRazorpayConfigured } from "@/lib/razorpay";
import { createClient, getSession } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Pay for your spot", robots: { index: false, follow: false } };

export default async function PayPage({ params }: PageProps<"/games/[slug]/pay">) {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  if (!game) notFound();
  const session = await getSession();
  if (!session) redirect(`/sign-in?next=/games/${slug}/pay`);
  if (!game.is_paid) redirect(`/games/${slug}`);

  const { state } = await getViewerState(game, session.userId, canTransact(session.profile));
  if (state.kind === "in" && state.conversationId) redirect(`/messages/${state.conversationId}`);
  if (state.kind !== "paid-open") redirect(`/games/${slug}`);
  if (!state.canTransact) redirect(`/me/edit?next=${encodeURIComponent(`/games/${slug}/pay`)}`);

  const supabase = await createClient();
  const { data: wallet } = await supabase.from("wallets").select("balance_paise").eq("user_id", session.userId).single();

  return (
    <div className="mx-auto max-w-xl px-4 pb-32 md:px-8">
      <PageHeader title="Pay for your spot" back={`/games/${slug}`} />
      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
        <SportIcon sport={game.sport} size={52} />
        <div className="min-w-0">
          <p className="truncate font-bold">{game.spot_name}</p>
          <p className="text-sm text-muted">{formatWhen(game.starts_at)} · hosted by {game.host.full_name ?? "a player"}</p>
        </div>
      </div>
      <PayForm
        gameId={game.id}
        slug={slug}
        description={`${game.spot_name} · ${formatWhen(game.starts_at)}`}
        sharePaise={game.fee_paise}
        feePaise={platformFee(game.fee_paise)}
        walletPaise={Number(wallet?.balance_paise ?? 0)}
        razorpayEnabled={isRazorpayConfigured()}
        email={session.email}
        name={session.profile?.full_name ?? null}
      />
    </div>
  );
}
