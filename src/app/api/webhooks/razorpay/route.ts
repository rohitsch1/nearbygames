import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Razorpay → server confirmation. Covers the case where the user closes the tab
 * before the browser calls /api/payments/verify. Configure in Razorpay Dashboard →
 * Webhooks with events: payment.captured, payment.failed.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  if (!verifyWebhookSignature(raw, signature)) return NextResponse.json({ error: "bad signature" }, { status: 400 });

  const event = JSON.parse(raw) as {
    event: string;
    payload?: { payment?: { entity?: { id: string; order_id: string; status: string } } };
  };
  const entity = event.payload?.payment?.entity;
  if (!entity?.order_id) return NextResponse.json({ ok: true });

  const admin = createAdminClient();
  const { data: payment } = await admin.from("payments").select("id").eq("provider_order_id", entity.order_id).maybeSingle();
  if (!payment) return NextResponse.json({ ok: true });

  if (event.event === "payment.captured") {
    const { error } = await admin.rpc("confirm_provider_payment", { p_payment: payment.id, p_provider_payment_id: entity.id });
    if (error) {
      console.error("[razorpay webhook] confirm failed", error);
      return NextResponse.json({ error: "retry" }, { status: 500 }); // Razorpay retries on non-2xx
    }
  } else if (event.event === "payment.failed") {
    await admin.rpc("fail_provider_payment", { p_payment: payment.id });
  }
  return NextResponse.json({ ok: true });
}
