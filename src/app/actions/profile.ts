"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { friendlyError } from "@/lib/errors";
import { SPORT_IDS } from "@/lib/sports";
import { createClient, getUserId } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

const profileSchema = z.object({
  full_name: z.string().trim().min(1, "Tell us your name").max(60),
  avatar_url: z.url().max(500).nullable().optional(),
  area_name: z.string().trim().max(80).nullable().optional().transform((v) => v || null),
  occupation: z.enum(["student", "working", "resident"]).nullable().optional(),
  id_verified: z.boolean().optional(),
  home: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).nullable().optional(),
});

export type ProfileInput = z.input<typeof profileSchema>;

export async function saveProfile(input: ProfileInput): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Please sign in again." };
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  const { home, ...fields } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ ...fields, profile_prompted: true })
    .eq("id", userId);
  if (error) return { ok: false, error: friendlyError(error) };

  if (home !== undefined) {
    const { error: locErr } = await supabase.rpc("set_home_location", { p_lat: home?.lat ?? null, p_lng: home?.lng ?? null });
    if (locErr) return { ok: false, error: friendlyError(locErr) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function skipProfile(): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Please sign in again." };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ profile_prompted: true }).eq("id", userId);
  return error ? { ok: false, error: friendlyError(error) } : { ok: true };
}

const tourSchema = z.object({ sports: z.array(z.enum(SPORT_IDS)).max(12) });

export async function completeTour(input: z.input<typeof tourSchema>): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Please sign in again." };
  const parsed = tourSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Pick valid sports" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ sports: parsed.data.sports, tour_completed: true, profile_prompted: true })
    .eq("id", userId);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function replayTour(): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Please sign in again." };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ tour_completed: false }).eq("id", userId);
  return error ? { ok: false, error: friendlyError(error) } : { ok: true };
}

export async function markNotificationsRead(): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Please sign in again." };
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null);
  return { ok: true };
}
