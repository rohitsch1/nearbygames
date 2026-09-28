import { NextResponse } from "next/server";
import { z } from "zod";
import { friendlyError } from "@/lib/errors";
import { env } from "@/lib/env";
import { isRazorpayConfigured, razorpay } from "@/lib/razorpay";
import { createAdminClient, getUserId } from "@/lib/supabase/server";

const schema = z.discriminatedUnion("purpose", [
  z.object({ purpose: z.literal("game"), gameId: z.uuid(), method: z.enum(["upi", "card"]) }),
  z.object({ purpose: z.literal("topup"), amountRupees: z.number().int().min(100).max(10000), method: z.enum(["upi", "card"]) }),
]);

/**
 * Creates a pending payment row (server-side price, never trusted from the client)
 * and, when Razorpay is configured, a matching Razorpay order for Checkout.
 */
export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const input = parsed.data;

  const admin = createAdminClient();
  const { data: payment, error } = await admin.rpc("create_provider_payment", {
    p_user: userId,
    p_purpose: input.purpose,
    p_game: input.purpose === "game" ? input.gameId : null,
    p_method: input.method,
    p_topup_paise: input.purpose === "topup" ? input.amountRupees * 100 : null,
  });
  if (error || !payment) return NextResponse.json({ error: friendlyError(error) }, { status: 400 });

  const p = payment as { id: string; amount_paise: number };

  // No provider wired up: keep the row as "pending" (matches the documented placeholder behaviour).
  if (!isRazorpayConfigured()) {
    return NextResponse.json({ mode: "pending", paymentId: p.id, amount: p.amount_paise });
  }

  try {
    const order = await razorpay().orders.create({
      amount: p.amount_paise,
      currency: "INR",
      receipt: p.id.replace(/-/g, "").slice(0, 40),
      notes: { payment_id: p.id, purpose: input.purpose },
    });
    await admin.from("payments").update({ provider_order_id: order.id }).eq("id", p.id);
    return NextResponse.json({
      mode: "razorpay",
      paymentId: p.id,
      orderId: order.id,
      amount: p.amount_paise,
      keyId: env.razorpayKeyId,
    });
  } catch (e) {
    console.error("[razorpay] order create failed", e);
    await admin.rpc("fail_provider_payment", { p_payment: p.id });
    return NextResponse.json({ error: "Couldn't start the payment. Try the wallet or pay in person." }, { status: 502 });
  }
}
