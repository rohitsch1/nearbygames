"use client";

import { clsx } from "clsx";
import { ImagePlus, Lock, Minus, Plus, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { createGame } from "@/app/actions/games";
import { LocationPicker } from "@/components/map/location-picker";
import { useReverseGeocode } from "@/components/map/maps-provider";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { APP_TIMEZONE } from "@/lib/format";
import { DEFAULT_CENTER, haversineMeters, type LatLng } from "@/lib/geo";
import { formatINR, platformFee } from "@/lib/money";
import { SPORTS, SPORT_BY_ID } from "@/lib/sports";
import { uploadImage } from "@/lib/upload";
import type { Sport } from "@/lib/types";

interface Props {
  userId: string;
  home: LatLng | null;
  hasName: boolean;
  canCharge: boolean;
  favouriteSports: Sport[];
}

/** Current date/time in IST as input-friendly strings, rounded up to the next half hour + 1h. */
function defaultWhen() {
  const d = new Date(Date.now() + 60 * 60_000);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

export function CreateGameForm({ userId, home, hasName, canCharge, favouriteSports }: Props) {
  const router = useRouter();
  const reverseGeocode = useReverseGeocode();
  const fileRef = useRef<HTMLInputElement>(null);
  const [initial] = useState(defaultWhen);
  const sports = useMemo(
    () => [...SPORTS.filter((s) => favouriteSports.includes(s.id)), ...SPORTS.filter((s) => !favouriteSports.includes(s.id))],
    [favouriteSports],
  );

  const [sport, setSport] = useState<Sport>(favouriteSports[0] ?? "football");
  const [photo, setPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [point, setPoint] = useState<LatLng | null>(home);
  const [spotName, setSpotName] = useState("");
  const [city, setCity] = useState("");
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [duration, setDuration] = useState(90);
  const [capacity, setCapacity] = useState(SPORT_BY_ID[favouriteSports[0] ?? "football"].defaultCapacity);
  const [capacityTouched, setCapacityTouched] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [fee, setFee] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const lastGeocoded = useRef<LatLng | null>(null);

  function pickSport(s: Sport) {
    setSport(s);
    if (!capacityTouched) setCapacity(SPORT_BY_ID[s].defaultCapacity);
  }

  async function onPoint(p: LatLng) {
    setPoint(p);
    if (!lastGeocoded.current || haversineMeters(lastGeocoded.current, p) > 800) {
      lastGeocoded.current = p;
      const { city: c } = await reverseGeocode(p.lat, p.lng);
      if (c) setCity((cur) => cur || c);
    }
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try { setPhoto(await uploadImage(f, "game-photos", userId)); }
    catch (err) { toast.error((err as Error).message); }
    finally { setUploading(false); e.target.value = ""; }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!point) errs.location = "Place the pin where the game is";
    if (spotName.trim().length < 2) errs.spot = "Name the spot so people can find it";
    const startsAt = `${date}T${time}:00+05:30`;
    if (new Date(startsAt).getTime() < Date.now()) errs.when = "Pick a time in the future";
    const feeNum = Number(fee);
    if (isPaid && (!feeNum || feeNum < 10)) errs.fee = "Set a fee of at least ₹10";
    setErrors(errs);
    if (Object.keys(errs).length) return toast.error(Object.values(errs)[0]);

    startTransition(async () => {
      const res = await createGame({
        sport, spot_name: spotName, city, notes, photo_url: photo, lat: point!.lat, lng: point!.lng,
        starts_at: new Date(startsAt).toISOString(), duration_minutes: duration, capacity, is_paid: isPaid, fee_rupees: isPaid ? feeNum : 0,
      });
      if (!res.ok) return void toast.error(res.error);
      toast.success("Your game is live on the map!");
      router.push(`/games/${res.data!.slug}`);
    });
  }

  if (!hasName) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6 text-center">
        <p className="text-lg font-bold">Add your name first</p>
        <p className="mt-1 text-muted">Players like to know who&apos;s hosting before they ask to join.</p>
        <Link href="/me/edit?next=/host/new" className="mt-4 inline-block font-semibold text-brand-strong">Add your name →</Link>
      </div>
    );
  }

  const feePaise = Math.round(Number(fee || 0) * 100);

  return (
    <form onSubmit={submit} className="space-y-8" noValidate>
      <section>
        <Label>Sport</Label>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 lg:grid-cols-6">
          {sports.map((s) => (
            <button key={s.id} type="button" onClick={() => pickSport(s.id)} aria-pressed={sport === s.id}
              className={clsx("flex shrink-0 flex-col items-center gap-1 rounded-xl border-2 px-4 py-3 transition sm:px-2",
                sport === s.id ? "border-brand bg-brand-soft" : "border-line bg-surface hover:bg-surface-2")}>
              <span className="text-2xl" aria-hidden>{s.emoji}</span>
              <span className="text-xs font-semibold">{s.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <Label hint="Optional — players find the gate faster">Photo of the ground</Label>
        {photo ? (
          <div className="relative aspect-[16/9] overflow-hidden rounded-2xl">
            <Image src={photo} alt="Ground photo" fill className="object-cover" sizes="(min-width: 768px) 700px, 100vw" />
            <button type="button" onClick={() => setPhoto(null)} aria-label="Remove photo"
              className="absolute right-2 top-2 flex size-9 items-center justify-center rounded-full bg-black/60 text-white">
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
            className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-surface text-muted hover:bg-surface-2">
            {uploading ? <Spinner className="size-6" /> : <ImagePlus className="size-7" />}
            <span className="text-sm font-semibold">{uploading ? "Uploading…" : "Add a photo"}</span>
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhoto} />
      </section>

      <section className="space-y-4">
        <div>
          <Label>Where exactly?</Label>
          <LocationPicker value={point} initialCenter={home ?? DEFAULT_CENTER} onChange={onPoint} />
          <FieldError>{errors.location}</FieldError>
        </div>
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <div>
            <Label htmlFor="spot">Name the spot</Label>
            <Input id="spot" value={spotName} onChange={(e) => setSpotName(e.target.value)} maxLength={80} placeholder="Gali No. 4, near Shiv Mandir" aria-invalid={!!errors.spot} />
            <FieldError>{errors.spot}</FieldError>
          </div>
          <div>
            <Label htmlFor="city">City</Label>
            <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} maxLength={60} placeholder="Hisar" />
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="date">Day</Label>
          <Input id="date" type="date" value={date} min={initial.date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="time">Start time</Label>
          <Input id="time" type="time" value={time} step={900} onChange={(e) => setTime(e.target.value)} aria-invalid={!!errors.when} />
        </div>
        <div>
          <Label htmlFor="duration">Duration</Label>
          <Select id="duration" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            {[30, 45, 60, 90, 120, 150, 180, 240].map((m) => <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60} h`}</option>)}
          </Select>
        </div>
        <FieldError>{errors.when}</FieldError>
      </section>

      <section>
        <Label hint="Including you">Players needed</Label>
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" aria-label="Fewer players" onClick={() => { setCapacityTouched(true); setCapacity((c) => Math.max(2, c - 1)); }} icon={<Minus className="size-4" />} />
          <span className="w-12 text-center text-2xl font-extrabold tabular-nums" aria-live="polite">{capacity}</span>
          <Button type="button" variant="outline" aria-label="More players" onClick={() => { setCapacityTouched(true); setCapacity((c) => Math.min(100, c + 1)); }} icon={<Plus className="size-4" />} />
        </div>
      </section>

      <section>
        <Label>Free or paid?</Label>
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => setIsPaid(false)} aria-pressed={!isPaid}
            className={clsx("rounded-2xl border-2 p-4 text-left transition", !isPaid ? "border-brand bg-brand-soft" : "border-line bg-surface")}>
            <p className="font-bold">Free</p>
            <p className="mt-1 text-sm text-muted">You personally approve each person who asks to join.</p>
          </button>
          <button type="button" onClick={() => canCharge ? setIsPaid(true) : toast.info("Complete your profile (incl. ID check) to host paid games.")} aria-pressed={isPaid}
            className={clsx("relative rounded-2xl border-2 p-4 text-left transition", isPaid ? "border-paid bg-paid-soft" : "border-line bg-surface", !canCharge && "opacity-70")}>
            <p className="flex items-center gap-1.5 font-bold">Paid {!canCharge && <Lock className="size-4" />}</p>
            <p className="mt-1 text-sm text-muted">Set a per-player fee. Payment is the approval — no requests to review.</p>
            {!canCharge && <Link href="/me/edit?next=/host/new" className="mt-2 inline-block text-sm font-semibold text-paid-strong" onClick={(e) => e.stopPropagation()}>Complete profile to unlock →</Link>}
          </button>
        </div>
        {isPaid && (
          <div className="mt-4 max-w-xs">
            <Label htmlFor="fee">Fee per player (₹)</Label>
            <Input id="fee" type="number" inputMode="numeric" min={10} max={10000} value={fee} onChange={(e) => setFee(e.target.value)} placeholder="60" aria-invalid={!!errors.fee} />
            <FieldError>{errors.fee}</FieldError>
            {feePaise >= 1000 && (
              <p className="mt-1.5 text-xs text-muted">
                You receive {formatINR(feePaise)} per player. Players pay {formatINR(feePaise + platformFee(feePaise))} incl. platform fee.
              </p>
            )}
          </div>
        )}
      </section>

      <section>
        <Label htmlFor="notes" hint={`${notes.length}/500`}>Notes for players</Label>
        <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} rows={3}
          placeholder="Tennis ball, 6 overs a side. Blue gate, ground floor. Bring water." />
      </section>

      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-line bg-surface/95 p-4 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
        <Button type="submit" size="lg" className="w-full" loading={pending} disabled={uploading}>Drop it on the map</Button>
      </div>
    </form>
  );
}
