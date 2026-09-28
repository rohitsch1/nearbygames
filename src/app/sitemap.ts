import type { MetadataRoute } from "next";
import { getActiveSportCities, getUpcomingGames } from "@/lib/queries";
import { absoluteUrl, citySlug, site } from "@/lib/site";
import { SPORTS, SPORT_BY_ID } from "@/lib/sports";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const [games, pairs] = await Promise.all([getUpcomingGames({ limit: 5000 }), getActiveSportCities()]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/map"), lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: absoluteUrl("/play"), lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: absoluteUrl("/privacy"), changeFrequency: "yearly", priority: 0.2 },
    { url: absoluteUrl("/terms"), changeFrequency: "yearly", priority: 0.2 },
  ];

  const sportPages = SPORTS.map((s) => ({
    url: absoluteUrl(`/play/${s.slug}`), lastModified: now, changeFrequency: "hourly" as const, priority: 0.8,
  }));

  // Featured cities for headline sports + every (sport, city) that has real games.
  const cityUrls = new Set<string>();
  ["football", "cricket", "badminton"].forEach((sp) => site.featuredCities.forEach((c) => cityUrls.add(`/play/${sp}/${citySlug(c)}`)));
  pairs.forEach((p) => cityUrls.add(`/play/${SPORT_BY_ID[p.sport].slug}/${p.citySlug}`));
  const cityPages = [...cityUrls].map((u) => ({ url: absoluteUrl(u), lastModified: now, changeFrequency: "hourly" as const, priority: 0.7 }));

  const gamePages = games.map((g) => ({
    url: absoluteUrl(`/games/${g.slug}`), lastModified: now, changeFrequency: "hourly" as const, priority: 0.6,
  }));

  return [...staticPages, ...sportPages, ...cityPages, ...gamePages];
}
