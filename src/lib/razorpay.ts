import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import Razorpay from "razorpay";
import { env, serverEnv } from "@/lib/env";

export function isRazorpayConfigured() {
  return Boolean(env.razorpayKeyId && serverEnv().razorpaySecret);
}

let instance: Razorpay | null = null;
export function razorpay() {
  if (!instance) instance = new Razorpay({ key_id: env.razorpayKeyId, key_secret: serverEnv().razorpaySecret });
  return instance;
}

function safeEqualHex(a: string, b: string) {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Signature returned to Checkout's handler: HMAC_SHA256(order_id|payment_id, key_secret). */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string) {
  const expected = createHmac("sha256", serverEnv().razorpaySecret).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqualHex(expected, signature);
}

/** Webhook signature: HMAC_SHA256(raw body, webhook_secret). */
export function verifyWebhookSignature(rawBody: string, signature: string) {
  const secret = serverEnv().razorpayWebhookSecret;
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}
