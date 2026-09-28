import { AppNav } from "@/components/layout/app-nav";
import { NotificationListener } from "@/components/layout/notification-listener";
import { createClient, getSession } from "@/lib/supabase/server";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();
  let pending = 0;
  if (session) {
    const supabase = await createClient();
    const { count } = await supabase
      .from("join_requests")
      .select("id, games!inner(host_id)", { count: "exact", head: true })
      .eq("status", "pending")
      .eq("games.host_id", session.userId);
    pending = count ?? 0;
  }

  return (
    <div className="min-h-dvh">
      <AppNav
        userId={session?.userId ?? null}
        name={session?.profile?.full_name ?? null}
        avatarUrl={session?.profile?.avatar_url ?? null}
        initialPending={pending}
      />
      {session && <NotificationListener userId={session.userId} />}
      <main id="main" className="md:pl-20 lg:pl-60">{children}</main>
    </div>
  );
}
