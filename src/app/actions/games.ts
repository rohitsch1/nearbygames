"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { friendlyError } from "@/lib/errors";
import { emailHostNewRequest, emailRequesterAccepted, emailRequesterDeclined } from "@/lib/request-emails";
import { SPORT_IDS } from "@/lib/sports";
import { createClient, getUserId } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

const uuid = z.uuid();

async function authed() {
  const userId = await getUserId();
  if (!userId) return null;
  return { userId, supabase: await createClient() };
}

// ---------------------------------------------------------------- create

const createSchema = z
  .object({
    sport: z.enum(SPORT_IDS),
    spot_name: z.string().trim().min(2, "Name the spot").max(80),
    city: z.string().trim().max(60).optional().transform((v) => v || null),
    notes: z.string().trim().max(500).optional().transform((v) => v || null),
    photo_url: z.url().max(500).nullable().optional(),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    starts_at: z.iso.datetime({ offset: true }),
    duration_minutes: z.number().int().min(15).max(600),
    capacity: z.number().int().min(2, "At least 2 players").max(100),
    is_paid: z.boolean(),
    fee_rupees: z.number().min(0).max(10000),
  })
  .refine((v) => !v.is_paid || v.fee_rupees >= 10, { message: "Set a fee of at least ₹10", path: ["fee_rupees"] })
  .refine((v) => new Date(v.starts_at).getTime() > Date.now() - 5 * 60_000, { message: "Pick a time in the future", path: ["starts_at"] })
  .refine((v) => new Date(v.starts_at).getTime() < Date.now() + 60 * 86400_000, { message: "Games can be up to 60 days ahead", path: ["starts_at"] });

export type CreateGameInput = z.input<typeof createSchema>;

export async function createGame(input: CreateGameInput): Promise<ActionResult<{ slug: string }>> {
  const ctx = await authed();
  if (!ctx) return { ok: false, error: "Please sign in to host a game." };
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  const { fee_rupees, ...v } = parsed.data;

  const { data, error } = await ctx.supabase
    .from("games")
    .insert({ ...v, host_id: ctx.userId, fee_paise: v.is_paid ? Math.round(fee_rupees * 100) : 0 })
    .select("slug")
    .single();
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/sitemap.xml");
  return { ok: true, data: { slug: data.slug as string } };
}

// ---------------------------------------------------------------- free-game requests

export async function requestToJoin(gameId: string, note: string): Promise<ActionResult> {
  const ctx = await authed();
  if (!ctx) return { ok: false, error: "Please sign in to ask to join." };
  if (!uuid.safeParse(gameId).success) return { ok: false, error: "Invalid game" };
  const { data, error } = await ctx.supabase.rpc("request_to_join", { p_game: gameId, p_note: note.slice(0, 280) });
  if (error) return { ok: false, error: friendlyError(error) };
  after(() => emailHostNewRequest(data as string));
  revalidatePath("/games/[slug]", "page");
  revalidatePath("/requests");
  revalidatePath("/messages");
  return { ok: true };
}

export async function withdrawRequest(requestId: string): Promise<ActionResult> {
  const ctx = await authed();
  if (!ctx) return { ok: false, error: "Please sign in again." };
  if (!uuid.safeParse(requestId).success) return { ok: false, error: "Invalid request" };
  const { error } = await ctx.supabase.rpc("withdraw_request", { p_request: requestId });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/games/[slug]", "page");
  revalidatePath("/requests");
  revalidatePath("/messages");
  return { ok: true };
}

export async function acceptRequest(requestId: string): Promise<ActionResult<{ conversationId: string }>> {
  const ctx = await authed();
  if (!ctx) return { ok: false, error: "Please sign in again." };
  if (!uuid.safeParse(requestId).success) return { ok: false, error: "Invalid request" };
  const { data, error } = await ctx.supabase.rpc("accept_request", { p_request: requestId });
  if (error) return { ok: false, error: friendlyError(error) };
  after(() => emailRequesterAccepted(requestId, data as string));
  revalidatePath("/requests");
  revalidatePath("/messages");
  return { ok: true, data: { conversationId: data as string } };
}

export async function declineRequest(requestId: string, reason: string): Promise<ActionResult> {
  const ctx = await authed();
  if (!ctx) return { ok: false, error: "Please sign in again." };
  if (!uuid.safeParse(requestId).success) return { ok: false, error: "Invalid request" };
  const { error } = await ctx.supabase.rpc("decline_request", { p_request: requestId, p_reason: reason.slice(0, 200) });
  if (error) return { ok: false, error: friendlyError(error) };
  after(() => emailRequesterDeclined(requestId));
  revalidatePath("/requests");
  return { ok: true };
}

/** Host opens a chat with someone who asked to join, before accepting or declining. */
export async function openRequestChat(requestId: string): Promise<ActionResult<{ conversationId: string }>> {
  const ctx = await authed();
  if (!ctx) return { ok: false, error: "Please sign in again." };
  if (!uuid.safeParse(requestId).success) return { ok: false, error: "Invalid request" };
  const { data, error } = await ctx.supabase.rpc("open_request_chat", { p_request: requestId });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/messages");
  revalidatePath("/requests");
  return { ok: true, data: { conversationId: data as string } };
}

// ---------------------------------------------------------------- paid games

export async function payWithWallet(gameId: string): Promise<ActionResult<{ conversationId: string }>> {
  const ctx = await authed();
  if (!ctx) return { ok: false, error: "Please sign in to pay." };
  if (!uuid.safeParse(gameId).success) return { ok: false, error: "Invalid game" };
  const { data, error } = await ctx.supabase.rpc("pay_with_wallet", { p_game: gameId });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/", "layout");
  return { ok: true, data: { conversationId: data as string } };
}

export async function joinPayInPerson(gameId: string): Promise<ActionResult<{ conversationId: string }>> {
  const ctx = await authed();
  if (!ctx) return { ok: false, error: "Please sign in to join." };
  if (!uuid.safeParse(gameId).success) return { ok: false, error: "Invalid game" };
  const { data, error } = await ctx.supabase.rpc("join_pay_in_person", { p_game: gameId });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/", "layout");
  return { ok: true, data: { conversationId: data as string } };
}

// ---------------------------------------------------------------- host tools

export async function cancelGame(gameId: string): Promise<ActionResult> {
  const ctx = await authed();
  if (!ctx) return { ok: false, error: "Please sign in again." };
  if (!uuid.safeParse(gameId).success) return { ok: false, error: "Invalid game" };
  const { error } = await ctx.supabase.rpc("cancel_game", { p_game: gameId });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setNoShow(gameId: string, userId: string, noShow: boolean): Promise<ActionResult> {
  const ctx = await authed();
  if (!ctx) return { ok: false, error: "Please sign in again." };
  if (!uuid.safeParse(gameId).success || !uuid.safeParse(userId).success) return { ok: false, error: "Invalid input" };
  const { error } = await ctx.supabase.rpc("set_no_show", { p_game: gameId, p_user: userId, p_no_show: noShow });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/games/[slug]", "page");
  return { ok: true };
}

// ---------------------------------------------------------------- reviews

const reviewSchema = z.object({
  gameId: uuid,
  revieweeId: uuid,
  rating: z.number().int().min(1, "Pick 1 to 5 stars").max(5, "Pick 1 to 5 stars"),
  comment: z.string().trim().max(500).optional().transform((v) => v || null),
});

export async function submitReview(input: z.input<typeof reviewSchema>): Promise<ActionResult> {
  const ctx = await authed();
  if (!ctx) return { ok: false, error: "Please sign in again." };
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the review" };
  const v = parsed.data;
  const { error } = await ctx.supabase.rpc("submit_review", {
    p_game: v.gameId, p_reviewee: v.revieweeId, p_rating: v.rating, p_comment: v.comment,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/games/[slug]", "page");
  revalidatePath("/me");
  return { ok: true };
}
