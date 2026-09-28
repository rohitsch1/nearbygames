// Centralised, typed access to environment variables.
// NEXT_PUBLIC_* values must be referenced literally so Next can inline them.

export const env = {
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, ""),
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  googleMapsKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
  googleMapsMapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID",
  razorpayKeyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "",
  phoneAuth: process.env.NEXT_PUBLIC_ENABLE_PHONE_AUTH === "true",
  appleAuth: process.env.NEXT_PUBLIC_ENABLE_APPLE_AUTH === "true",
};

export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseKey);

/** Server-only secrets. Importing this from a client component will throw at build time. */
export function serverEnv() {
  if (typeof window !== "undefined") throw new Error("serverEnv() called in the browser");
  return {
    supabaseSecret: process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    razorpaySecret: process.env.RAZORPAY_KEY_SECRET ?? "",
    razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? "",
  };
}
