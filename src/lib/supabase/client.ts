"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

let client: SupabaseClient | undefined;

/** Singleton browser client (auth session lives in cookies shared with the server). */
export function createClient() {
  if (!client) client = createBrowserClient(env.supabaseUrl, env.supabaseKey);
  return client;
}
