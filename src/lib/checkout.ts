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
  prefill?: { email?: string; contact?: string; name?: string };
  method?: { upi?: boolean; card?: boolean; netbanking?: boolean; wallet?: boolean };
  theme?: { color?: string };
  handler: (r: RazorpayResponse) => void;
  modal?: { ondismiss?: () => void };
}
declare global {
  interface Window { Razorpay?: new (o: RazorpayOptions) => { open: () => void; on: (e: string, cb: () => void) => void } }
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
      prefill: { email: opts.email ?? undefined, name: opts.name ?? undefined },
      method: { upi: opts.method === "upi", card: opts.method === "card", netbanking: false, wallet: false },
      theme: { color: "#12b76a" },
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
    rzp.on("payment.failed", () => { /* Checkout shows the error and lets the user retry */ });
    rzp.open();
  });
}
