"use client";

import { clsx } from "clsx";
import { Banknote, CreditCard, Smartphone, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { joinPayInPerson, payWithWallet } from "@/app/actions/games";
import { Button } from "@/components/ui/button";
import { payWithRazorpay, type OrderResponse } from "@/lib/checkout";
import { formatINR } from "@/lib/money";
import type { PaymentMethod } from "@/lib/types";

interface Props {
  gameId: string;
  slug: string;
  description: string;
  sharePaise: number;
  feePaise: number;
  walletPaise: number;
  razorpayEnabled: boolean;
  email: string | null;
  name: string | null;
}

export function PayForm({ gameId, slug, description, sharePaise, feePaise, walletPaise, razorpayEnabled, email, name }: Props) {
  const router = useRouter();
  const total = sharePaise + feePaise;
  const walletEnough = walletPaise >= total;
  const [method, setMethod] = useState<PaymentMethod>(walletEnough ? "wallet" : "upi");
  const [busy, setBusy] = useState(false);

  const methods: { id: PaymentMethod; label: string; sub: string; icon: typeof Wallet; disabled?: boolean }[] = [
    { id: "wallet", label: "nearbygames wallet", sub: walletEnough ? `Balance ${formatINR(walletPaise)}` : `Balance ${formatINR(walletPaise)} — not enough`, icon: Wallet, disabled: !walletEnough },
    { id: "upi", label: "UPI", sub: razorpayEnabled ? "GPay, PhonePe, Paytm, any UPI app" : "Test mode — recorded as pending", icon: Smartphone },
    { id: "card", label: "Card", sub: razorpayEnabled ? "Debit or credit card" : "Test mode — recorded as pending", icon: CreditCard },
    { id: "in_person", label: "Pay the host at the ground", sub: `Hand over ${formatINR(sharePaise)} in cash or UPI when you arrive`, icon: Banknote },
  ];

  async function pay() {
    setBusy(true);
    try {
      if (method === "wallet" || method === "in_person") {
        const res = method === "wallet" ? await payWithWallet(gameId) : await joinPayInPerson(gameId);
        if (!res.ok) throw new Error(res.error);
        toast.success("You're in! Say hi to your host.");
        router.replace(`/messages/${res.data!.conversationId}`);
        return;
      }
      const orderRes = await fetch("/api/payments/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "game", gameId, method }),
      });
      const order = (await orderRes.json()) as OrderResponse & { error?: string };
      if (!orderRes.ok) throw new Error(order.error ?? "Couldn't start payment");
      if (order.mode === "pending") {
        toast.info("Card/UPI payments aren't live yet — your payment was recorded as pending. Use the wallet or pay in person to join now.");
        setBusy(false);
        return;
      }
      const result = await payWithRazorpay(order, { description, method, email, name });
      if (!result) { setBusy(false); return; }
      if (result.status === "refunded_to_wallet") {
        toast.warning("The game filled up while you were paying — the full amount is back in your wallet.");
        router.replace(`/games/${slug}`);
      } else {
        toast.success("Payment received — you're in!");
        router.replace(result.conversation_id ? `/messages/${result.conversation_id}` : `/games/${slug}`);
      }
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  const payingNow = method === "in_person" ? 0 : total;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-3 font-bold">What you&apos;re paying</h2>
        <dl className="space-y-2 text-[15px]">
          <Row label="Court / turf share" value={formatINR(sharePaise)} />
          <Row label="Platform fee" value={method === "in_person" ? formatINR(0) : formatINR(feePaise)} hint={method === "in_person" ? "waived for in-person" : undefined} />
          <div className="my-2 border-t border-dashed border-line" />
          <Row label={method === "in_person" ? "Pay now" : "Total"} value={formatINR(payingNow)} strong />
        </dl>
      </section>

      <fieldset>
        <legend className="mb-3 font-bold">How do you want to pay?</legend>
        <div className="space-y-2">
          {methods.map((m) => (
            <label key={m.id}
              className={clsx("flex cursor-pointer items-center gap-3 rounded-2xl border-2 bg-surface p-4 transition",
                method === m.id ? "border-paid bg-paid-soft" : "border-line hover:bg-surface-2",
                m.disabled && "cursor-not-allowed opacity-60")}>
              <input type="radio" name="method" value={m.id} checked={method === m.id} disabled={m.disabled}
                onChange={() => setMethod(m.id)} className="sr-only" />
              <span className={clsx("flex size-10 items-center justify-center rounded-xl", method === m.id ? "bg-paid text-white" : "bg-surface-2 text-muted")}>
                <m.icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{m.label}</span>
                <span className="block text-sm text-muted">{m.sub}</span>
              </span>
              <span className={clsx("size-5 rounded-full border-2", method === m.id ? "border-[6px] border-paid" : "border-line")} />
            </label>
          ))}
        </div>
        {!walletEnough && (
          <p className="mt-3 text-sm text-muted">
            <Link href={`/me/wallet?next=${encodeURIComponent(`/games/${slug}/pay`)}`} className="font-semibold text-brand-strong">Add money to wallet</Link>
            {" "}for one-tap payments next time.
          </p>
        )}
      </fieldset>

      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-line bg-surface/95 p-4 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
        <Button variant="paid" size="lg" className="w-full" loading={busy} onClick={pay}>
          {method === "in_person" ? "Join now, pay at the ground" : `Pay ${formatINR(total)} and join`}
        </Button>
        <p className="mt-2 text-center text-xs text-subtle">You&apos;re in the moment payment goes through — no approval step.</p>
      </div>
    </div>
  );
}

function Row({ label, value, strong, hint }: { label: string; value: string; strong?: boolean; hint?: string }) {
  return (
    <div className={clsx("flex items-baseline justify-between", strong && "text-lg font-extrabold")}>
      <dt className={strong ? "" : "text-muted"}>{label}{hint && <span className="ml-1 text-xs text-subtle">({hint})</span>}</dt>
      <dd className={strong ? "" : "font-semibold"}>{value}</dd>
    </div>
  );
}
