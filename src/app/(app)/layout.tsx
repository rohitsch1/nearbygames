import { AppNav } from "@/components/layout/app-nav";
import { NotificationListener } from "@/components/layout/notification-listener";
import { getSession } from "@/lib/supabase/server";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();

  return (
    <div className="min-h-dvh">
      <AppNav
        userId={session?.userId ?? null}
        name={session?.profile?.full_name ?? null}
        avatarUrl={session?.profile?.avatar_url ?? null}
      />
      {session && <NotificationListener userId={session.userId} />}
      <main id="main" className="md:pl-20 lg:pl-60">{children}</main>
    </div>
  );
}
