import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Turn a Postgres/PostgREST error into a message safe to show users.
 * Our RPCs raise friendly messages with errcode P0001; anything else is generic.
 */
export function friendlyError(error: PostgrestError | Error | null | undefined, fallback = "Something went wrong. Please try again.") {
  if (!error) return fallback;
  const e = error as PostgrestError;
  if (e.code === "P0001" || e.code === "42501" || e.code === "28000") return e.message;
  if (e.code === "23505") return "That already exists.";
  if (e.code === "23514") return "Some details aren't valid — please check the form.";
  if (process.env.NODE_ENV !== "production") console.error("[db]", error);
  return fallback;
}
