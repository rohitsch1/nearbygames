import { GameListItem } from "@/components/game/game-list-item";
import { LinkButton } from "@/components/ui/button";
import type { PublicGameRow } from "@/lib/queries";
import type { SportInfo } from "@/lib/sports";

export function SeoGameList({ games, sport, where }: { games: PublicGameRow[]; sport: SportInfo; where?: string }) {
  if (games.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-line bg-surface p-8 text-center">
        <p className="text-4xl" aria-hidden>{sport.emoji}</p>
        <p className="mt-3 text-lg font-bold">No {sport.noun} listed{where ? ` in ${where}` : ""} right now</p>
        <p className="mx-auto mt-1 max-w-md text-muted">Be the first — drop a game on the map and players nearby will see it within seconds.</p>
        <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
          <LinkButton href="/sign-in?next=/host/new">Host a {sport.label.toLowerCase()} game</LinkButton>
          <LinkButton href="/map" variant="outline">Open the live map</LinkButton>
        </div>
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {games.map((g) => <GameListItem key={g.id} game={g} />)}
    </div>
  );
}
