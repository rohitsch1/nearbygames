"use client";

import { clsx } from "clsx";
import { Check, LocateFixed, MapPin, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { completeTour } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { firstName } from "@/lib/format";
import { SPORTS } from "@/lib/sports";
import type { Sport } from "@/lib/types";

import { LOCATION_PREF_KEY } from "@/lib/geo";

interface Props { initialSports: Sport[]; next: string; name: string | null }

export function WelcomeTour({ initialSports, next, name }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [sports, setSports] = useState<Sport[]>(initialSports);
  const [pending, startTransition] = useTransition();

  const toggle = (s: Sport) => setSports((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  function finish(location: "granted" | "denied") {
    try { localStorage.setItem(LOCATION_PREF_KEY, location); } catch { /* ignore */ }
    startTransition(async () => {
      const res = await completeTour({ sports });
      if (!res.ok) return void toast.error(res.error);
      router.replace(next);
      router.refresh();
    });
  }

  function askLocation() {
    if (!navigator.geolocation) return finish("denied");
    navigator.geolocation.getCurrentPosition(
      () => finish("granted"),
      () => finish("denied"),
      { timeout: 10000 },
    );
  }

  return (
    <div>
      <div className="mb-8 flex gap-1.5" aria-label={`Step ${step + 1} of 3`}>
        {[0, 1, 2].map((i) => <span key={i} className={clsx("h-1.5 flex-1 rounded-full transition", i <= step ? "bg-brand" : "bg-line")} />)}
      </div>

      {step === 0 && (
        <section className="animate-fade-up">
          <h1 className="text-3xl font-extrabold tracking-tight">Welcome{name ? `, ${firstName(name)}` : ""} 👋</h1>
          <p className="mt-2 text-lg text-muted">Open the map, tap a game, ask to join. That&apos;s it.</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-line bg-surface p-5">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-strong">Free games</span>
              <p className="mt-2 font-bold">You ask. The host says yes.</p>
              <p className="mt-1 text-sm text-muted">Hosts see who&apos;s asking before letting strangers in.</p>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-5">
              <span className="text-xs font-bold uppercase tracking-wider text-paid-strong">Paid games</span>
              <p className="mt-2 font-bold">Pay your share. You&apos;re in.</p>
              <p className="mt-1 text-sm text-muted">No waiting — the payment already did the vetting.</p>
            </div>
          </div>
          <Button size="lg" className="mt-8 w-full" onClick={() => setStep(1)}>Next</Button>
        </section>
      )}

      {step === 1 && (
        <section className="animate-fade-up">
          <h1 className="text-3xl font-extrabold tracking-tight">What do you play?</h1>
          <p className="mt-2 text-muted">We&apos;ll show these first. Pick as many as you like.</p>
          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SPORTS.map((s) => {
              const on = sports.includes(s.id);
              return (
                <button key={s.id} type="button" onClick={() => toggle(s.id)} aria-pressed={on}
                  className={clsx("relative flex items-center gap-2 rounded-xl border-2 px-3 py-3 text-left font-semibold transition",
                    on ? "border-brand bg-brand-soft" : "border-line bg-surface hover:bg-surface-2")}>
                  <span className="text-xl" aria-hidden>{s.emoji}</span>
                  <span className="text-sm">{s.label}</span>
                  {on && <Check className="ml-auto size-4 text-brand-strong" />}
                </button>
              );
            })}
          </div>
          <div className="mt-8 flex gap-2">
            <Button variant="ghost" size="lg" onClick={() => setStep(0)}>Back</Button>
            <Button size="lg" className="flex-1" onClick={() => setStep(2)}>{sports.length ? "Next" : "Skip"}</Button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="animate-fade-up">
          <div className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-brand-soft text-brand-strong">
            <MapPin className="size-8" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Show games near you</h1>
          <p className="mt-2 text-muted">
            Let nearbygames use your location to centre the map where you are. Say no and we&apos;ll use your saved neighbourhood.
          </p>
          <div className="mt-6 flex gap-3 rounded-2xl border border-line bg-surface p-4 text-sm">
            <ShieldCheck className="size-5 shrink-0 text-brand" />
            <p><span className="font-semibold">Your exact location is never shown to anyone.</span>{" "}
              <span className="text-muted">Other players only ever see a distance, like “400 m away”.</span></p>
          </div>
          <div className="mt-8 flex flex-col gap-2">
            <Button size="lg" onClick={askLocation} loading={pending} icon={<LocateFixed className="size-5" />}>Use my location</Button>
            <Button size="lg" variant="ghost" onClick={() => finish("denied")} disabled={pending}>Not now</Button>
          </div>
        </section>
      )}
    </div>
  );
}
