import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/auth/profile-form";
import { safeNext } from "@/lib/site";
import { getSession } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Complete your profile" };

export default async function OnboardingProfilePage({ searchParams }: PageProps<"/onboarding/profile">) {
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : null);
  const session = await getSession();
  if (!session?.profile) redirect(`/sign-in?next=${encodeURIComponent(next)}`);

  return (
    <div className="animate-fade-up">
      <p className="text-sm font-semibold text-brand-strong">Step 1 of 2 · optional</p>
      <h1 className="mt-1 text-3xl font-extrabold tracking-tight">A little about you</h1>
      <p className="mb-8 mt-2 text-muted">Hosts see this when you ask to join. You can skip it and add it later.</p>
      <ProfileForm profile={session.profile} userId={session.userId} mode="onboarding" next={next} />
    </div>
  );
}
