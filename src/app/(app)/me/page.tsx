import { ChevronRight, LogOut, Pencil, ShieldCheck, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MeActions } from "@/components/auth/me-actions";
import { GameListItem, type GameListItemData } from "@/components/game/game-list-item";
import { Avatar } from "@/components/ui/avatar";
import { LinkButton } from "@/components/ui/button";
import { formatINR } from "@/lib/money";
import { canTransact, verificationSteps } from "@/lib/profile";
import { SPORT_BY_ID } from "@/lib/sports";
import { createClient, getSession } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/format";
import type { WalletTx } from "@/lib/types";

export const metadata: Metadata = { title: "Me", robots: { index: false, follow: false } };

export default async function MePage() {
  const session = await getSession();
  if (!session?.profile) redirect("/sign-in?next=/me");
  const p = session.profile;
  const supabase = await createClient();

  const [{ data: stats }, { data: wallet }, { data: txs }, { data: myGames }] = await Promise.all([
    supabase.rpc("player_stats", { p_user: session.userId }),
    supabase.from("wallets").select("balance_paise").eq("user_id", session.userId).single(),
    supabase.from("wallet_transactions").select("id, amount_paise, kind, description, created_at").order("created_at", { ascending: false }).limit(5),
    supabase
      .from("game_participants")
      .select("joined_via, game:games(slug, sport, spot_name, city, starts_at, duration_minutes, capacity, players_count, is_paid, fee_paise, status)")
      .eq("user_id", session.userId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const s = (stats as { games_played: number; games_hosted: number; no_shows: number }[] | null)?.[0] ?? { games_played: 0, games_hosted: 0, no_shows: 0 };
  const steps = verificationSteps(p, Boolean(session.email || session.phone));
  const done = steps.filter((x) => x.done).length;
  const unlocked = canTransact(p);

  type Row = { joined_via: string; game: GameListItemData & { duration_minutes: number; status: string } };
  const rows = ((myGames ?? []) as unknown as Row[]).filter((r) => r.game && r.game.status !== "cancelled");
  const { upcoming, past } = splitByTime(rows);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 md:px-8 md:pt-6">
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <section className="rounded-3xl border border-line bg-surface p-5">
            <div className="flex items-center gap-4">
              <Avatar name={p.full_name} src={p.avatar_url} size={72} />
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-xl font-extrabold">{p.full_name ?? "Guest player"}</h1>
                <p className="truncate text-sm text-muted">{p.area_name ?? "Add your area"}</p>
              </div>
              <Link href="/me/edit" aria-label="Edit profile" className="flex size-10 items-center justify-center rounded-full bg-surface-2 hover:bg-line">
                <Pencil className="size-4" />
              </Link>
            </div>
            <dl className="mt-5 grid grid-cols-3 divide-x divide-line rounded-2xl bg-surface-2 py-3 text-center">
              <Stat label="Played" value={s.games_played} />
              <Stat label="Hosted" value={s.games_hosted} />
              <Stat label="No-shows" value={s.no_shows} danger={s.no_shows > 0} />
            </dl>
          </section>

          <section className="rounded-3xl border border-line bg-surface p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-bold"><ShieldCheck className="size-5 text-brand" /> Verification</h2>
              <span className="text-sm font-semibold text-muted">{done}/4</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(done / 4) * 100}%` }} />
            </div>
            <ul className="mt-3 space-y-1.5 text-sm">
              {steps.map((st) => (
                <li key={st.label} className={st.done ? "text-ink" : "text-subtle"}>{st.done ? "✓" : "○"} {st.label}</li>
              ))}
            </ul>
            <p className="mt-3 rounded-xl bg-surface-2 p-3 text-sm text-muted">
              {unlocked ? "Everything unlocked — you can pay for games and host paid games." :
                "Right now you can browse and join free games. Complete your profile to pay for games or charge for yours."}
            </p>
            {!unlocked && <LinkButton href="/me/edit" size="sm" variant="secondary" className="mt-3 w-full">Complete profile</LinkButton>}
          </section>

          <section className="rounded-3xl border border-line bg-surface p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-bold"><Wallet className="size-5 text-paid" /> Wallet</h2>
              <Link href="/me/wallet" className="text-sm font-semibold text-brand-strong">Add money</Link>
            </div>
            <p className="mt-2 text-3xl font-extrabold">{formatINR(Number(wallet?.balance_paise ?? 0))}</p>
            <p className="text-xs text-muted">Money from games you host settles here.</p>
            {(txs ?? []).length > 0 && (
              <ul className="mt-4 space-y-2 border-t border-line pt-3 text-sm">
                {(txs as WalletTx[]).map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-muted">{t.description ?? t.kind} · {timeAgo(t.created_at)}</span>
                    <span className={`shrink-0 font-semibold ${t.amount_paise >= 0 ? "text-brand-strong" : ""}`}>
                      {t.amount_paise >= 0 ? "+" : "−"}{formatINR(Math.abs(t.amount_paise))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/me/wallet" className="mt-3 flex items-center justify-between text-sm font-semibold text-muted">All transactions <ChevronRight className="size-4" /></Link>
          </section>
        </div>

        <div className="space-y-6">
          <section>
            <h2 className="mb-3 text-lg font-bold">Upcoming games</h2>
            {upcoming.length ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {upcoming.map((r) => (
                  <div key={r.game.slug} className="relative">
                    <GameListItem game={r.game} />
                    {r.joined_via === "host" && <span className="absolute right-3 top-3 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-bold text-brand-strong">Hosting</span>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
                Nothing lined up. <Link href="/map" className="font-semibold text-brand-strong">Find a game</Link> or <Link href="/host/new" className="font-semibold text-brand-strong">start one</Link>.
              </p>
            )}
          </section>

          {past.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-bold">Past games</h2>
              <div className="grid gap-2 opacity-80 sm:grid-cols-2">
                {past.map((r) => <GameListItem key={r.game.slug} game={r.game} />)}
              </div>
            </section>
          )}

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Sports you play</h2>
              <Link href="/onboarding/tour?next=/me" className="text-sm font-semibold text-brand-strong">Edit</Link>
            </div>
            <div className="flex flex-wrap gap-2">
              {p.sports.length ? p.sports.map((sp) => (
                <span key={sp} className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-semibold">
                  {SPORT_BY_ID[sp].emoji} {SPORT_BY_ID[sp].label}
                </span>
              )) : <p className="text-sm text-muted">None picked yet.</p>}
            </div>
          </section>

          <section className="space-y-2">
            <MeActions />
            <form action="/auth/signout" method="post">
              <button type="submit" className="flex h-12 w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 font-semibold text-danger hover:bg-danger-soft">
                <LogOut className="size-5" /> Sign out
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}

function splitByTime<T extends { game: { starts_at: string; duration_minutes: number } }>(rows: T[]) {
  const now = Date.now();
  const upcoming = rows
    .filter((r) => new Date(r.game.starts_at).getTime() + r.game.duration_minutes * 60_000 > now)
    .sort((a, b) => a.game.starts_at.localeCompare(b.game.starts_at));
  const past = rows.filter((r) => !upcoming.includes(r)).slice(0, 10);
  return { upcoming, past };
}

function Stat({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div>
      <dd className={`text-xl font-extrabold ${danger ? "text-danger" : ""}`}>{value}</dd>
      <dt className="text-xs text-muted">{label}</dt>
    </div>
  );
}
