import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/site";
import { getSession } from "@/lib/supabase/server";

// Single place that decides where a freshly signed-in user goes next:
// profile step (once) → welcome tour (once) → wherever they were headed.
export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const session = await getSession();
  if (!session) return NextResponse.redirect(`${origin}/sign-in?next=${encodeURIComponent(next)}`);

  const p = session.profile;
  if (!p?.profile_prompted) return NextResponse.redirect(`${origin}/onboarding/profile?next=${encodeURIComponent(next)}`);
  if (!p.tour_completed) return NextResponse.redirect(`${origin}/onboarding/tour?next=${encodeURIComponent(next)}`);
  return NextResponse.redirect(`${origin}${next}`);
}
