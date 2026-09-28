import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

// OAuth (Google / Apple) lands here with ?code=… (PKCE).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/auth/continue?next=${encodeURIComponent(next)}`);
  }
  return NextResponse.redirect(`${origin}/sign-in?error=oauth&next=${encodeURIComponent(next)}`);
}
