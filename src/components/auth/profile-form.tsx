"use client";

import { clsx } from "clsx";
import { Camera, GraduationCap, Briefcase, Building2, LocateFixed, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveProfile, skipProfile } from "@/app/actions/profile";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { useReverseGeocode } from "@/components/map/maps-provider";
import { uploadImage } from "@/lib/upload";
import type { Occupation, Profile } from "@/lib/types";

const occupations: { id: Occupation; label: string; icon: typeof Briefcase; hint: string }[] = [
  { id: "student", label: "Student", icon: GraduationCap, hint: "College or campus" },
  { id: "working", label: "Working", icon: Briefcase, hint: "Office nearby" },
  { id: "resident", label: "Resident", icon: Building2, hint: "Live in the society" },
];

interface Props {
  profile: Profile;
  userId: string;
  mode: "onboarding" | "edit";
  next: string;
}

export function ProfileForm({ profile, userId, mode, next }: Props) {
  const router = useRouter();
  const reverseGeocode = useReverseGeocode();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(profile.full_name ?? "");
  const [avatar, setAvatar] = useState(profile.avatar_url);
  const [area, setArea] = useState(profile.area_name ?? "");
  const [occupation, setOccupation] = useState<Occupation | null>(profile.occupation);
  const [idVerified, setIdVerified] = useState(profile.id_verified);
  const [home, setHome] = useState<{ lat: number; lng: number } | null | undefined>(undefined);
  const [uploading, setUploading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [pending, startTransition] = useTransition();

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      setAvatar(await uploadImage(file, "avatars", userId));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) return toast.error("Location isn't available on this device");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setHome(point);
        const { area: a } = await reverseGeocode(point.lat, point.lng);
        if (a && !area) setArea(a);
        setLocating(false);
        toast.success("Neighbourhood saved (rounded to ~100 m — never shown to anyone)");
      },
      () => {
        setLocating(false);
        toast.error("Couldn't get your location. Type your area instead.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Tell us your name");
    startTransition(async () => {
      const res = await saveProfile({
        full_name: name, avatar_url: avatar, area_name: area || null, occupation, id_verified: idVerified,
        ...(home !== undefined ? { home } : {}),
      });
      if (!res.ok) return void toast.error(res.error);
      toast.success("Profile saved");
      router.push(mode === "onboarding" ? `/onboarding/tour?next=${encodeURIComponent(next)}` : next);
      router.refresh();
    });
  }

  function skip() {
    startTransition(async () => {
      const res = await skipProfile();
      if (!res.ok) return void toast.error(res.error);
      router.push(`/onboarding/tour?next=${encodeURIComponent(next)}`);
    });
  }

  const complete = [name.trim(), area.trim(), occupation, idVerified].filter(Boolean).length;

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => fileRef.current?.click()} className="relative rounded-full" aria-label="Add a photo">
          <Avatar name={name || "You"} src={avatar} size={80} />
          <span className="absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-full border-2 border-surface bg-brand text-white">
            {uploading ? <span className="size-3 animate-spin rounded-full border-2 border-white border-r-transparent" /> : <Camera className="size-4" />}
          </span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickPhoto} />
        <div className="text-sm text-muted">
          <p className="font-semibold text-ink">Add a photo</p>
          Hosts accept faces faster than blank circles.
        </div>
      </div>

      <div>
        <Label htmlFor="name">Your name</Label>
        <Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Your name" />
      </div>

      <div>
        <Label htmlFor="area" hint="Neighbourhood or campus — not an address">Where you play</Label>
        <div className="flex gap-2">
          <Input id="area" value={area} onChange={(e) => setArea(e.target.value)} maxLength={80} placeholder="Model Town" />
          <Button type="button" variant="outline" onClick={useMyLocation} loading={locating} icon={<LocateFixed className="size-4" />} aria-label="Use my location">
            <span className="hidden sm:inline">Locate</span>
          </Button>
        </div>
      </div>

      <div>
        <Label>You are…</Label>
        <div className="grid grid-cols-3 gap-2">
          {occupations.map((o) => (
            <button key={o.id} type="button" onClick={() => setOccupation(o.id)} aria-pressed={occupation === o.id}
              className={clsx("flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-center transition",
                occupation === o.id ? "border-brand bg-brand-soft" : "border-line bg-surface hover:bg-surface-2")}>
              <o.icon className={clsx("size-5", occupation === o.id ? "text-brand-strong" : "text-muted")} />
              <span className="text-sm font-semibold">{o.label}</span>
              <span className="hidden text-[11px] text-subtle sm:block">{o.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface p-4">
        <input type="checkbox" checked={idVerified} onChange={(e) => setIdVerified(e.target.checked)} className="mt-0.5 size-5 accent-[var(--brand)]" />
        <span className="text-sm">
          <span className="flex items-center gap-1.5 font-semibold"><ShieldCheck className="size-4 text-brand" /> ID check (optional)</span>
          <span className="mt-0.5 block text-muted">I confirm my name matches a government ID. Needed to pay for, or charge for, games.</span>
        </span>
      </label>

      <div className="rounded-xl bg-surface-2 p-3 text-sm text-muted">
        <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(complete / 4) * 100}%` }} />
        </div>
        {complete === 4 ? "All set — paid games unlocked." : "Guests can browse and join free games. Complete all four to pay for or host paid games."}
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        {mode === "onboarding" && (
          <Button type="button" variant="ghost" size="lg" className="sm:flex-1" onClick={skip} disabled={pending}>Skip for now</Button>
        )}
        <Button type="submit" size="lg" className="sm:flex-1" loading={pending} disabled={uploading}>
          {mode === "onboarding" ? "Continue" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
