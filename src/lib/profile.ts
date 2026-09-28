import type { Profile } from "@/lib/types";

/** Mirrors public.can_transact() — needed to pay for or charge for games. */
export function canTransact(p: Profile | null | undefined) {
  return Boolean(p?.full_name && p.area_name && p.occupation && p.id_verified);
}

export function verificationSteps(p: Profile | null | undefined, contactVerified: boolean) {
  return [
    { label: "Phone or email verified", done: contactVerified },
    { label: "Name added", done: Boolean(p?.full_name) },
    { label: "Area & occupation", done: Boolean(p?.area_name && p?.occupation) },
    { label: "ID check", done: Boolean(p?.id_verified) },
  ];
}
