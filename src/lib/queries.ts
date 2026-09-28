import "server-only";

import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient, createPublicClient } from "@/lib/supabase/server";
import type { Game, JoinRequest, PublicProfile } from "@/lib/types";

export type GameWithHost = Game & { host: PublicProfile };

/** Public game lookup (no auth needed) — used by the page and generateMetadata; deduped per request. */
export const getGameBySlug = cache(async (slug: string): Promise<GameWithHost | null> => {
  if (!isSupabaseConfigured || !/^[a-z0-9-]{3,80}$/.test(slug)) return null;
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("games")
    .select("*, host:profiles!games_host_id_fkey(id, full_name, avatar_url, area_name)")
    .eq("slug", slug)
    .maybeSingle();
  return (data as GameWithHost | null) ?? null;
});

export type ViewerState =
  | { kind: "signed-out" }
  | { kind: "cancelled" }
  | { kind: "ended" }
  | { kind: "host" }
  | { kind: "in"; conversationId: string | null }
  | { kind: "full" }
  | { kind: "paid-open"; canTransact: boolean }
  | { kind: "requested"; requestId: string }
  | { kind: "declined"; reason: string | null }
  | { kind: "free-open" };

export interface Participant { user_id: string; no_show: boolean; profile: PublicProfile }

/** What the bottom of the game page should offer this viewer — mirrors the rules in the DB. */
export async function getViewerState(game: Game, userId: string | null, canTransact: boolean): Promise<{
  state: ViewerState;
  participants: Participant[];
  pendingCount: number;
}> {
  const ended = new Date(game.starts_at).getTime() + game.duration_minutes * 60_000 < Date.now();
  if (!userId) {
    return { state: game.status === "cancelled" ? { kind: "cancelled" } : ended ? { kind: "ended" } : { kind: "signed-out" }, participants: [], pendingCount: 0 };
  }
  const supabase = await createClient();
  const [{ data: roster }, { data: reqs }] = await Promise.all([
    // Per-game roster RPC: participants aren't directly readable by non-members.
    supabase.rpc("game_roster", { p_game: game.id }),
    supabase
      .from("join_requests")
      .select("id, requester_id, status, decline_reason, created_at")
      .eq("game_id", game.id)
      .order("created_at", { ascending: false }),
  ]);
  const participants: Participant[] = ((roster ?? []) as { user_id: string; full_name: string | null; avatar_url: string | null; no_show: boolean }[])
    .map((r) => ({ user_id: r.user_id, no_show: r.no_show, profile: { id: r.user_id, full_name: r.full_name, avatar_url: r.avatar_url, area_name: null } }));
  const requests = (reqs ?? []) as Pick<JoinRequest, "id" | "requester_id" | "status" | "decline_reason">[];
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  if (game.host_id === userId) return { state: { kind: "host" }, participants, pendingCount };
  if (participants.some((p) => p.user_id === userId)) {
    const { data: conv } = await supabase.from("conversations").select("id").eq("game_id", game.id).eq("player_id", userId).maybeSingle();
    return { state: { kind: "in", conversationId: (conv?.id as string) ?? null }, participants, pendingCount };
  }
  if (game.status === "cancelled") return { state: { kind: "cancelled" }, participants, pendingCount };
  if (ended) return { state: { kind: "ended" }, participants, pendingCount };

  const mine = requests.filter((r) => r.requester_id === userId);
  const pending = mine.find((r) => r.status === "pending");
  const declined = mine.find((r) => r.status === "declined");

  if (game.players_count >= game.capacity) return { state: { kind: "full" }, participants, pendingCount };
  if (game.is_paid) return { state: { kind: "paid-open", canTransact }, participants, pendingCount };
  if (pending) return { state: { kind: "requested", requestId: pending.id }, participants, pendingCount };
  if (declined) return { state: { kind: "declined", reason: declined.decline_reason }, participants, pendingCount };
  return { state: { kind: "free-open" }, participants, pendingCount };
}

export interface PublicGameRow {
  id: string; slug: string; sport: Game["sport"]; spot_name: string; city: string | null; city_slug: string | null;
  starts_at: string; capacity: number; players_count: number; is_paid: boolean; fee_paise: number; lat: number; lng: number;
}

/** Upcoming open games for SEO pages (public, no auth). */
export async function getUpcomingGames(opts: { sport?: Game["sport"]; citySlug?: string; limit?: number } = {}) {
  if (!isSupabaseConfigured) return [];
  const supabase = createPublicClient();
  let q = supabase
    .from("games")
    .select("id, slug, sport, spot_name, city, city_slug, starts_at, capacity, players_count, is_paid, fee_paise, lat, lng")
    .eq("status", "open")
    .gt("starts_at", new Date(Date.now() - 60 * 60_000).toISOString())
    .order("starts_at", { ascending: true })
    .limit(opts.limit ?? 24);
  if (opts.sport) q = q.eq("sport", opts.sport);
  if (opts.citySlug) q = q.eq("city_slug", opts.citySlug);
  const { data } = await q;
  return (data ?? []) as PublicGameRow[];
}

/** Distinct (sport, city) pairs that have had games — feeds the sitemap and city links. */
export async function getActiveSportCities(limit = 2000) {
  if (!isSupabaseConfigured) return [];
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("games")
    .select("sport, city, city_slug")
    .not("city_slug", "is", null)
    .gt("starts_at", new Date(Date.now() - 90 * 86400_000).toISOString())
    .limit(limit);
  const seen = new Map<string, { sport: Game["sport"]; city: string; citySlug: string }>();
  (data ?? []).forEach((r) => {
    const key = `${r.sport}/${r.city_slug}`;
    if (!seen.has(key)) seen.set(key, { sport: r.sport as Game["sport"], city: r.city as string, citySlug: r.city_slug as string });
  });
  return [...seen.values()];
}
