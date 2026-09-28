import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from "react";
import { env, serverEnv } from "@/lib/env";
import type { Profile } from "@/lib/types";

/** Per-request server client bound to the user's auth cookies. */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: cookies are read-only there.
          // The proxy refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}

/**
 * Cookie-less client with the public key — for public, cacheable reads
 * (SEO pages, sitemap) that must not depend on who is looking.
 */
export function createPublicClient() {
  return createPlainClient(env.supabaseUrl, env.supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Service-role client. Bypasses RLS — only for trusted server code (payments, webhooks). */
export function createAdminClient() {
  const { supabaseSecret } = serverEnv();
  if (!supabaseSecret) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createPlainClient(env.supabaseUrl, supabaseSecret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Verified current user id (JWT checked), deduped per request. */
export const getUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return (data?.claims?.sub as string | undefined) ?? null;
});

/** Current user + profile, deduped per request. */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", claims.sub).single<Profile>();
  return {
    userId: claims.sub as string,
    email: (claims.email as string | undefined) ?? null,
    phone: (claims.phone as string | undefined) || null,
    profile,
  };
});
