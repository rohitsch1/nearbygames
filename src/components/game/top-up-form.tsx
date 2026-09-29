"use client";

import { clsx } from "clsx";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { payWithRazorpay, type OrderResponse } from "@/lib/checkout";

const PRESETS = [200, 500, 1000, 2000];

export function TopUpForm({ enabled, next, email, name }: { enabled: boolean; next: string; email: string | null; name: string | null }) {
  const router = useRouter();
  const [amount, setAmount] = useState(500);
  const [busy, setBusy] = useState(false);

  async function topUp(method: "upi" | "card") {
    if (amount < 100 || amount > 10000) return toast.error("Top-ups are between ₹100 and ₹10,000");
    setBusy(true);
    try {
      const res = await fetch("/api/payments/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "topup", amountRupees: amount, method }),
      });
      const order = (await res.json()) as OrderResponse & { error?: string };
      if (!res.ok) throw new Error(order.error ?? "Couldn't start payment");
      if (order.mode === "pending") {
        toast.info("Online payments are switched off on the server (no Razorpay keys found), so this top-up was recorded as pending.");
        return;
      }
      const result = await payWithRazorpay(order, { description: "Wallet top-up", method, email, name });
      if (result) {
        toast.success(`₹${amount} added to your wallet`);
        router.push(next);
        router.refresh();
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-line bg-surface p-4">
      <h2 className="font-bold">Add money</h2>
      {!enabled && <p className="mt-1 text-sm text-muted">Online top-ups are off until Razorpay keys are added on the server.</p>}
      <div className="mt-4 grid grid-cols-4 gap-2">
        {PRESETS.map((p) => (
          <button key={p} type="button" onClick={() => setAmount(p)} aria-pressed={amount === p}
            className={clsx("h-11 rounded-xl border-2 text-sm font-bold", amount === p ? "border-brand bg-brand-soft" : "border-line")}>₹{p}</button>
        ))}
      </div>
      <div className="mt-3">
        <Label htmlFor="amt">Or enter an amount (₹)</Label>
        <Input id="amt" type="number" inputMode="numeric" min={100} max={10000} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="primary" loading={busy} onClick={() => topUp("upi")}>Pay with UPI</Button>
        <Button variant="outline" disabled={busy} onClick={() => topUp("card")}>Card</Button>
      </div>
    </section>
  );
}
