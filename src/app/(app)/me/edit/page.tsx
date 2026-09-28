import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/auth/profile-form";
import { MapsProvider } from "@/components/map/maps-provider";
import { PageHeader } from "@/components/ui/page-header";
import { safeNext } from "@/lib/site";
import { getSession } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Edit profile", robots: { index: false, follow: false } };

export default async function EditProfilePage({ searchParams }: PageProps<"/me/edit">) {
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : null, "/me");
  const session = await getSession();
  if (!session?.profile) redirect(`/sign-in?next=/me/edit`);
  return (
    <div className="mx-auto max-w-lg px-4 pb-24 md:px-8">
      <PageHeader title="Your profile" back="/me" />
      <MapsProvider>
        <ProfileForm profile={session.profile} userId={session.userId} mode="edit" next={next} />
      </MapsProvider>
    </div>
  );
}
