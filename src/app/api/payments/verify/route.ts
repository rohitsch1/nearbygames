import { NextResponse } from "next/server";
import { z } from "zod";
import { friendlyError } from "@/lib/errors";
import { verifyCheckoutSignature } from "@/lib/razorpay";
import { createAdminClient, getUserId } from "@/lib/supabase/server";

const schema = z.object({
  paymentId: z.uuid(),
  razorpay_order_id: z.string().min(1).max(64),
  razorpay_payment_id: z.string().min(1).max(64),
  razorpay_signature: z.string().min(1).max(256),
});

/** Called by the browser after Razorpay Checkout succeeds. Signature-verified; idempotent with the webhook. */
export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const b = parsed.data;

  if (!verifyCheckoutSignature(b.razorpay_order_id, b.razorpay_payment_id, b.razorpay_signature)) {
    return NextResponse.json({ error: "Payment verification failed" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select("id, user_id, provider_order_id")
    .eq("id", b.paymentId)
    .maybeSingle();
  if (!payment || payment.user_id !== userId || payment.provider_order_id !== b.razorpay_order_id) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  const { data, error } = await admin.rpc("confirm_provider_payment", {
    p_payment: b.paymentId,
    p_provider_payment_id: b.razorpay_payment_id,
  });
  if (error) return NextResponse.json({ error: friendlyError(error) }, { status: 400 });
  return NextResponse.json(data);
}
