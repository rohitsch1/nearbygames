"use client";

import { Star } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { submitReview } from "@/app/actions/games";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { StarPicker } from "@/components/ui/rating";
import { firstName } from "@/lib/format";

export interface ReviewTarget { userId: string; name: string | null; avatar: string | null; isHost: boolean }
export type ExistingReview = { rating: number; comment: string | null };

/** "Rate the people you played with": one row per other participant, editable later. */
export function ReviewPanel({ gameId, people, existing }: {
  gameId: string; people: ReviewTarget[]; existing: Record<string, ExistingReview>;
}) {
  if (people.length === 0) return null;
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h3 className="flex items-center gap-2 font-bold"><Star className="size-5 fill-amber-400 text-amber-400" aria-hidden /> Rate who you played with</h3>
      <p className="mt-1 text-sm text-muted">Only people who played in this game can rate each other. Reviews close 24 hours after the game ends, and you can change yours until then.</p>
      <ul className="mt-4 divide-y divide-line">
        {people.map((p) => <ReviewRow key={p.userId} gameId={gameId} person={p} initial={existing[p.userId]} />)}
      </ul>
    </section>
  );
}

function ReviewRow({ gameId, person, initial }: { gameId: string; person: ReviewTarget; initial?: ExistingReview }) {
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [saved, setSaved] = useState(initial ?? null);
  const [pending, startTransition] = useTransition();
  const dirty = rating !== (saved?.rating ?? 0) || comment.trim() !== (saved?.comment ?? "");

  const save = () =>
    startTransition(async () => {
      const res = await submitReview({ gameId, revieweeId: person.userId, rating, comment });
      if (!res.ok) return void toast.error(res.error);
      setSaved({ rating, comment: comment.trim() || null });
      toast.success(`Thanks! Your review of ${firstName(person.name)} is saved.`);
    });

  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-center gap-3">
        <Avatar name={person.name} src={person.avatar} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{person.name ?? "Player"}</p>
          <p className="text-xs text-muted">{person.isHost ? "Host" : "Player"}{saved ? " · reviewed" : ""}</p>
        </div>
        <StarPicker value={rating} onChange={setRating} disabled={pending} />
      </div>
      {rating > 0 && (
        <div className="mt-2 flex gap-2">
          <Input value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} disabled={pending}
            placeholder={`How was playing with ${firstName(person.name)}? (optional)`} aria-label={`Review of ${person.name ?? "player"}`} />
          <Button onClick={save} loading={pending} disabled={!dirty} className="shrink-0">{saved ? "Update" : "Save"}</Button>
        </div>
      )}
    </li>
  );
}
