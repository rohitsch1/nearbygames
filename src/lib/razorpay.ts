import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import Razorpay from "razorpay";
import { serverEnv } from "@/lib/env";

/**
 * Read the key id at *request time*. `process.env.NEXT_PUBLIC_*` written literally is
 * frozen into the build, so keys added to .env.local after `next build` were ignored.
 * A computed property name keeps this a real runtime lookup on the server.
 */
export function razorpayKeyId() {
  const publicName = ["NEXT_PUBLIC", "RAZORPAY_KEY_ID"].join("_");
  return (process.env.RAZORPAY_KEY_ID || process.env[publicName] || "").trim();
}

export function isRazorpayConfigured() {
  return Boolean(razorpayKeyId() && serverEnv().razorpaySecret.trim());
}

let instance: { key: string; client: Razorpay } | null = null;
export function razorpay() {
  const key = razorpayKeyId();
  const secret = serverEnv().razorpaySecret.trim();
  if (!instance || instance.key !== `${key}:${secret}`) {
    instance = { key: `${key}:${secret}`, client: new Razorpay({ key_id: key, key_secret: secret }) };
  }
  return instance.client;
}

/** Turn a Razorpay SDK error into a message that tells you what to fix. */
export function describeRazorpayError(e: unknown) {
  const err = e as { statusCode?: number; error?: { description?: string; code?: string } };
  if (err?.statusCode === 401) return "Razorpay rejected the API keys. Check NEXT_PUBLIC_RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are a matching Test-mode pair.";
  return err?.error?.description ?? "Couldn't reach Razorpay. Try the wallet or pay in person.";
}

function safeEqualHex(a: string, b: string) {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Signature returned to Checkout's handler: HMAC_SHA256(order_id|payment_id, key_secret). */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string) {
  const expected = createHmac("sha256", serverEnv().razorpaySecret.trim()).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqualHex(expected, signature);
}

/** Webhook signature: HMAC_SHA256(raw body, webhook_secret). */
export function verifyWebhookSignature(rawBody: string, signature: string) {
  const secret = serverEnv().razorpayWebhookSecret;
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}
