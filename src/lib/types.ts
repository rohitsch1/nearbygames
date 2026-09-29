// Domain types mirroring supabase/migrations. Regenerate DB types with `npm run db:types`
// if you want fully generated typings; these hand-written ones cover what the app reads.

export type Sport =
  | "football" | "cricket" | "badminton" | "basketball" | "tennis" | "table_tennis"
  | "volleyball" | "pickleball" | "chess" | "gaming" | "running" | "other";

export type Occupation = "student" | "working" | "resident";
export type RequestStatus = "pending" | "accepted" | "declined" | "withdrawn";
export type PaymentMethod = "wallet" | "upi" | "card" | "in_person";

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  area_name: string | null;
  occupation: Occupation | null;
  id_verified: boolean;
  sports: Sport[];
  no_shows: number;
  profile_prompted: boolean;
  tour_completed: boolean;
  created_at: string;
}

export type PublicProfile = Pick<Profile, "id" | "full_name" | "avatar_url" | "area_name">;

export interface Game {
  id: string;
  slug: string;
  host_id: string;
  sport: Sport;
  spot_name: string;
  city: string | null;
  city_slug: string | null;
  notes: string | null;
  photo_url: string | null;
  lat: number;
  lng: number;
  starts_at: string;
  duration_minutes: number;
  capacity: number;
  is_paid: boolean;
  fee_paise: number;
  players_count: number;
  status: "open" | "cancelled";
  created_at: string;
}

export interface NearbyGame {
  id: string;
  slug: string;
  sport: Sport;
  spot_name: string;
  city: string | null;
  photo_url: string | null;
  lat: number;
  lng: number;
  starts_at: string;
  duration_minutes: number;
  capacity: number;
  players_count: number;
  is_paid: boolean;
  fee_paise: number;
  host_id: string;
  distance_m: number;
}

export interface JoinRequest {
  id: string;
  game_id: string;
  requester_id: string;
  note: string | null;
  status: RequestStatus;
  decline_reason: string | null;
  created_at: string;
  responded_at: string | null;
}

export interface HostRequestRow {
  id: string;
  game_id: string;
  game_slug: string;
  spot_name: string;
  sport: Sport;
  starts_at: string;
  requester_id: string;
  full_name: string | null;
  avatar_url: string | null;
  area_name: string | null;
  games_played: number;
  no_shows: number;
  note: string | null;
  status: RequestStatus;
  created_at: string;
  distance_band: string | null;
  id_verified: boolean;
  rating_avg: number | null;
  rating_count: number;
  /** Chat with this requester, if the host has opened one (or they're in). */
  conversation_id: string | null;
}

/** in = player is in the game, requested = request still pending, closed = read-only. */
export type ConversationStatus = "in" | "requested" | "closed";

export interface ReviewRow {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer_name: string;
  reviewer_avatar: string | null;
  sport: Sport;
}

export interface Conversation {
  id: string;
  game_id: string;
  host_id: string;
  player_id: string;
  last_message_at: string;
  last_message: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  client_id: string | null;
  created_at: string;
}

export interface WalletTx {
  id: string;
  amount_paise: number;
  kind: "topup" | "game_payment" | "host_earning" | "refund" | "adjustment";
  description: string | null;
  created_at: string;
}

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string };
