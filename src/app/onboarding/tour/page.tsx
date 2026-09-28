import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WelcomeTour } from "@/components/auth/welcome-tour";
import { safeNext } from "@/lib/site";
import { getSession } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Welcome" };

export default async function TourPage({ searchParams }: PageProps<"/onboarding/tour">) {
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : null);
  const session = await getSession();
  if (!session?.profile) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  return <WelcomeTour initialSports={session.profile.sports} next={next} name={session.profile.full_name} />;
}
