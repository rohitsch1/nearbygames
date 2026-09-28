import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes that need a signed-in user. Everything else (landing, map, game pages,
// sport pages) is public so it can be browsed and indexed.
const PROTECTED = [/^\/requests/, /^\/messages/, /^\/me/, /^\/host/, /^\/onboarding/, /^\/games\/[^/]+\/pay/];
const AUTH_ONLY = [/^\/sign-in/];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  // Refreshes the session cookie if needed. Do not put code between client creation and this call.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  if (!signedIn && PROTECTED.some((r) => r.test(pathname))) {
    const to = request.nextUrl.clone();
    to.pathname = "/sign-in";
    to.search = `?next=${encodeURIComponent(pathname + search)}`;
    return redirectWithCookies(to, response);
  }
  // Signed-in users skip the marketing page and land on the map (home base).
  if (signedIn && (pathname === "/" || AUTH_ONLY.some((r) => r.test(pathname)))) {
    const to = request.nextUrl.clone();
    to.pathname = "/map";
    to.search = "";
    return redirectWithCookies(to, response);
  }
  return response;
}

function redirectWithCookies(url: URL, from: NextResponse) {
  const res = NextResponse.redirect(url);
  from.cookies.getAll().forEach((c) => res.cookies.set(c));
  return res;
}

export const config = {
  matcher: [
    // Skip static assets, images, metadata files and webhooks.
    "/((?!_next/static|_next/image|api/webhooks|favicon.ico|icon|apple-icon|manifest.webmanifest|robots.txt|sitemap.xml|opengraph-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
