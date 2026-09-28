import type { Metadata } from "next";
import Link from "next/link";
import { SPORTS } from "@/lib/sports";

export const metadata: Metadata = {
  title: "Find pickup games by sport",
  description: "Browse pickup football, cricket, badminton, basketball, tennis, pickleball, chess and gaming meetups near you on nearbygames.",
  alternates: { canonical: "/play" },
};

export default function PlayIndex() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:px-8 md:py-16">
      <h1 className="text-4xl font-extrabold tracking-tight">Find a game by sport</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">Pick a sport to see upcoming games near you, or open the live map to see everything at once.</p>
      <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SPORTS.map((s) => (
          <Link key={s.id} href={`/play/${s.slug}`} className="flex gap-4 rounded-2xl border border-line bg-surface p-5 hover:border-brand hover:shadow-card">
            <span className="text-4xl" aria-hidden>{s.emoji}</span>
            <span>
              <span className="block text-lg font-bold">{s.label} near me</span>
              <span className="mt-1 block text-sm text-muted">{s.blurb}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
