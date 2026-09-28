import { env } from "@/lib/env";

export const site = {
  name: "nearbygames",
  tagline: "Find or start a pickup game near you",
  description:
    "nearbygames shows every pickup game happening near you — football, cricket, badminton, chess, FIFA nights and more. Ask to join free games, pay your share for paid ones, or drop your own game on the map.",
  url: env.siteUrl,
  locale: "en_IN",
  twitter: "@nearbygames",
  themeColor: "#12b76a",
  /** Cities we pre-render landing pages for (more are added automatically from real games). */
  featuredCities: ["Bengaluru", "Mumbai", "Delhi", "Hyderabad", "Pune", "Chennai", "Gurugram", "Noida", "Kolkata", "Ahmedabad"],
};

export function absoluteUrl(path = "/") {
  return `${site.url}${path.startsWith("/") ? path : `/${path}`}`;
}

export function citySlug(city: string) {
  return city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Only allow same-site relative redirects (prevents open-redirects via ?next=). */
export function safeNext(next: string | null | undefined, fallback = "/map") {
  if (!next || !next.startsWith("/") || next.length > 512) return fallback;
  // Browsers strip tabs/newlines and treat "\\" like "/", so "/\t/evil.com" would become "//evil.com".
  if (/[\u0000-\u001f\u007f\\]/.test(next) || next.startsWith("//")) return fallback;
  try {
    const base = "https://nearbygames.invalid";
    const url = new URL(next, base);
    if (url.origin !== base) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
