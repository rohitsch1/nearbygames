import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TopUpForm } from "@/components/game/top-up-form";
import { PageHeader } from "@/components/ui/page-header";
import { formatINR } from "@/lib/money";
import { isRazorpayConfigured } from "@/lib/razorpay";
import { safeNext } from "@/lib/site";
import { createClient, getSession } from "@/lib/supabase/server";
import type { WalletTx } from "@/lib/types";

export const metadata: Metadata = { title: "Wallet", robots: { index: false, follow: false } };

const txDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

export default async function WalletPage({ searchParams }: PageProps<"/me/wallet">) {
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : null, "/me/wallet");
  const session = await getSession();
  if (!session) redirect("/sign-in?next=/me/wallet");
  const supabase = await createClient();
  const [{ data: wallet }, { data: txs }] = await Promise.all([
    supabase.from("wallets").select("balance_paise").eq("user_id", session.userId).single(),
    supabase.from("wallet_transactions").select("id, amount_paise, kind, description, created_at").order("created_at", { ascending: false }).limit(100),
  ]);

  return (
    <div className="mx-auto max-w-xl px-4 pb-24 md:px-8">
      <PageHeader title="Wallet" back="/me" />
      <section className="rounded-3xl bg-gradient-to-br from-brand-strong to-brand p-6 text-white">
        <p className="text-sm font-semibold text-white/80">Balance</p>
        <p className="mt-1 text-4xl font-extrabold">{formatINR(Number(wallet?.balance_paise ?? 0))}</p>
        <p className="mt-2 text-sm text-white/80">Use it to join paid games in one tap. Host earnings land here too.</p>
      </section>

      <TopUpForm enabled={isRazorpayConfigured()} next={next} email={session.email} name={session.profile?.full_name ?? null} />

      <section className="mt-8">
        <h2 className="mb-3 font-bold">Transactions</h2>
        {(txs ?? []).length === 0 ? (
          <p className="text-sm text-muted">No transactions yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {(txs as WalletTx[]).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{t.description ?? t.kind}</p>
                  <p className="text-xs text-muted">{txDate.format(new Date(t.created_at))}</p>
                </div>
                <span className={`shrink-0 font-bold ${t.amount_paise >= 0 ? "text-brand-strong" : ""}`}>
                  {t.amount_paise >= 0 ? "+" : "−"}{formatINR(Math.abs(t.amount_paise))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
