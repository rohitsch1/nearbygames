import "server-only";

import { sendEmail } from "@/lib/email";
import { newRequestEmail, requestAcceptedEmail, requestDeclinedEmail, type GameInfo } from "@/lib/email-templates";
import { firstName, formatFullDate } from "@/lib/format";
import { absoluteUrl } from "@/lib/site";
import { SPORT_BY_ID } from "@/lib/sports";
import { createAdminClient } from "@/lib/supabase/server";
import type { Sport } from "@/lib/types";

// These run inside after(), once the user already has their response. The admin client is
// needed to read email addresses from Supabase Auth; nothing here is sent back to the browser.

type Person = { id: string; full_name: string | null; id_verified: boolean; no_shows: number };
interface RequestRow {
  id: string;
  note: string | null;
  decline_reason: string | null;
  distance_band: string | null;
  requester: Person;
  game: { id: string; sport: Sport; spot_name: string; starts_at: string; host: Person };
}

async function loadRequest(requestId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("join_requests")
    .select(`id, note, decline_reason, distance_band,
      requester:profiles!join_requests_requester_id_fkey(id, full_name, id_verified, no_shows),
      game:games(id, sport, spot_name, starts_at, host:profiles!games_host_id_fkey(id, full_name, id_verified, no_shows))`)
    .eq("id", requestId)
    .maybeSingle();
  return { admin, row: data as unknown as RequestRow | null };
}

async function emailOf(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const { data } = await admin.auth.admin.getUserById(userId);
  return data.user?.email ?? null;
}

function gameInfo(g: RequestRow["game"]): GameInfo {
  const sport = SPORT_BY_ID[g.sport];
  return { emoji: sport.emoji, sport: sport.label, spot: g.spot_name, when: formatFullDate(g.starts_at) };
}

/** Host gets: "<name> ✓ wants to join", with rating, games played and their note. */
export async function emailHostNewRequest(requestId: string) {
  try {
    const { admin, row } = await loadRequest(requestId);
    if (!row) return;
    const to = await emailOf(admin, row.game.host.id);
    if (!to) return;

    const r = row.requester;
    const [{ data: reviews }, { count: played }] = await Promise.all([
      admin.from("reviews").select("rating").eq("reviewee_id", r.id),
      admin.from("game_participants").select("game_id, games!inner(starts_at)", { count: "exact", head: true })
        .eq("user_id", r.id).neq("joined_via", "host").eq("no_show", false).lt("games.starts_at", new Date().toISOString()),
    ]);
    const ratings = (reviews ?? []).map((x) => x.rating as number);

    await sendEmail(newRequestEmail({
      to,
      hostName: firstName(row.game.host.full_name, "there"),
      requester: {
        name: r.full_name ?? "A player",
        verified: r.id_verified,
        ratingAvg: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
        ratingCount: ratings.length,
        gamesPlayed: played ?? 0,
        noShows: r.no_shows,
      },
      note: row.note,
      distanceBand: row.distance_band,
      game: gameInfo(row.game),
      url: absoluteUrl(`/requests?tab=hosting&game=${row.game.id}`),
    }));
  } catch (e) {
    console.error("[email] new-request email failed", e);
  }
}

/** Requester gets: "You're in!" with a link to the chat. */
export async function emailRequesterAccepted(requestId: string, conversationId: string) {
  try {
    const { admin, row } = await loadRequest(requestId);
    if (!row) return;
    const to = await emailOf(admin, row.requester.id);
    if (!to) return;
    await sendEmail(requestAcceptedEmail({
      to,
      requesterName: firstName(row.requester.full_name, "there"),
      hostName: firstName(row.game.host.full_name, "The host"),
      game: gameInfo(row.game),
      url: absoluteUrl(`/messages/${conversationId}`),
    }));
  } catch (e) {
    console.error("[email] accepted email failed", e);
  }
}

/** Requester gets: "declined", with the host's reason if they gave one. */
export async function emailRequesterDeclined(requestId: string) {
  try {
    const { admin, row } = await loadRequest(requestId);
    if (!row) return;
    const to = await emailOf(admin, row.requester.id);
    if (!to) return;
    await sendEmail(requestDeclinedEmail({
      to,
      requesterName: firstName(row.requester.full_name, "there"),
      hostName: firstName(row.game.host.full_name, "The host"),
      game: gameInfo(row.game),
      reason: row.decline_reason,
      url: absoluteUrl("/map"),
    }));
  } catch (e) {
    console.error("[email] declined email failed", e);
  }
}
