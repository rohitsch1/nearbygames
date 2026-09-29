"use client";

// Minimal typing for Razorpay Checkout (https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/)
interface RazorpayResponse { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }
interface RazorpayOptions {
  key: string;
  amount: number;
  currency: "INR";
  name: string;
  description: string;
  order_id: string;
  prefill?: { email?: string; contact?: string; name?: string; method?: "upi" | "card" };
  theme?: { color?: string };
  config?: {
    display: {
      blocks: Record<string, { name: string; instruments: Record<string, unknown>[] }>;
      sequence: string[];
      preferences: { show_default_blocks: boolean };
    };
  };
  handler: (r: RazorpayResponse) => void;
  modal?: { ondismiss?: () => void };
}
declare global {
  interface Window { Razorpay?: new (o: RazorpayOptions) => { open: () => void; on: (e: string, cb: (r: { error?: { description?: string } }) => void) => void } }
}

let loading: Promise<void> | null = null;
function loadScript() {
  if (window.Razorpay) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { loading = null; reject(new Error("Couldn't load the payment window")); };
    document.body.appendChild(s);
  });
  return loading;
}

export type OrderResponse =
  | { mode: "pending"; paymentId: string; amount: number }
  | { mode: "razorpay"; paymentId: string; orderId: string; amount: number; keyId: string };

export type ConfirmResult = { status: "joined" | "already_paid" | "refunded_to_wallet" | "topped_up"; conversation_id?: string | null };

/** Opens Razorpay Checkout and resolves with the server-confirmed result, or null if the user closed it. */
export async function payWithRazorpay(order: Extract<OrderResponse, { mode: "razorpay" }>, opts: {
  description: string; method: "upi" | "card"; email?: string | null; name?: string | null;
}): Promise<ConfirmResult | null> {
  await loadScript();
  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay!({
      key: order.keyId,
      amount: order.amount,
      currency: "INR",
      name: "nearbygames",
      description: opts.description,
      order_id: order.orderId,
      // Don't whitelist methods: hiding everything except one (e.g. UPI) leaves Checkout empty when
      // that method isn't enabled on the account. We only *prefer* the one the user picked.
      prefill: { email: opts.email ?? undefined, name: opts.name ?? undefined, method: opts.method },
      theme: { color: "#12b76a" },
      config: checkoutDisplay(opts.method),
      handler: async (r) => {
        try {
          const res = await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paymentId: order.paymentId, ...r }),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? "Payment verification failed");
          resolve(json as ConfirmResult);
        } catch (e) {
          reject(e);
        }
      },
      modal: { ondismiss: () => resolve(null) },
    });
    // Checkout shows the failure and lets the user retry; we just log it for debugging.
    rzp.on("payment.failed", (r) => console.warn("[razorpay] payment failed:", r?.error?.description));
    rzp.open();
  });
}

/**
 * Put UPI at the top of Razorpay Checkout: QR code (scan with any UPI app — shown on desktop),
 * app buttons like Google Pay / PhonePe / Paytm (intent — shown on phones) and "enter UPI ID" (collect).
 * Razorpay still only shows UPI if it's enabled for your account (Dashboard → Account & Settings → Payment methods).
 * Other enabled methods (cards, netbanking, wallets) stay visible underneath.
 */
function checkoutDisplay(preferred: "upi" | "card"): RazorpayOptions["config"] {
  return {
    display: {
      blocks: {
        upi: {
          name: "Pay with UPI — scan QR, Google Pay, PhonePe or UPI ID",
          instruments: [{ method: "upi", flows: ["qr", "intent", "collect"], apps: ["google_pay", "phonepe", "paytm", "bhim"] }],
        },
        cards: { name: "Cards", instruments: [{ method: "card" }] },
      },
      sequence: preferred === "card" ? ["block.cards", "block.upi"] : ["block.upi", "block.cards"],
      preferences: { show_default_blocks: true },
    },
  };
}
