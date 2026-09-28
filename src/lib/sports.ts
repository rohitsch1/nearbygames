import type { Sport } from "@/lib/types";

export interface SportInfo {
  id: Sport;
  slug: string;
  label: string;
  emoji: string;
  /** Plural noun for SEO copy, e.g. "football games". */
  noun: string;
  blurb: string;
  defaultCapacity: number;
}

export const SPORTS: SportInfo[] = [
  { id: "football", slug: "football", label: "Football", emoji: "⚽", noun: "football games", defaultCapacity: 14,
    blurb: "5-a-side and 7-a-side turf games, society-ground kickabouts and weekend matches." },
  { id: "cricket", slug: "cricket", label: "Cricket", emoji: "🏏", noun: "cricket matches", defaultCapacity: 16,
    blurb: "Box cricket, tennis-ball games on the society ground and weekend leather-ball matches." },
  { id: "badminton", slug: "badminton", label: "Badminton", emoji: "🏸", noun: "badminton games", defaultCapacity: 4,
    blurb: "Doubles on booked courts — split the court fee and fill the last spot fast." },
  { id: "basketball", slug: "basketball", label: "Basketball", emoji: "🏀", noun: "basketball games", defaultCapacity: 10,
    blurb: "Half-court 3v3 and full-court runs at parks, campuses and clubhouses." },
  { id: "tennis", slug: "tennis", label: "Tennis", emoji: "🎾", noun: "tennis games", defaultCapacity: 4,
    blurb: "Singles and doubles hits — find a partner at your level nearby." },
  { id: "table_tennis", slug: "table-tennis", label: "Table tennis", emoji: "🏓", noun: "table tennis games", defaultCapacity: 4,
    blurb: "Clubhouse and office TT tables — quick games any evening." },
  { id: "volleyball", slug: "volleyball", label: "Volleyball", emoji: "🏐", noun: "volleyball games", defaultCapacity: 12,
    blurb: "Beach and court volleyball, casual and competitive." },
  { id: "pickleball", slug: "pickleball", label: "Pickleball", emoji: "🥒", noun: "pickleball games", defaultCapacity: 4,
    blurb: "The fastest-growing racquet sport — easy to learn, easy to find a four." },
  { id: "chess", slug: "chess", label: "Chess", emoji: "♟️", noun: "chess meetups", defaultCapacity: 8,
    blurb: "Café meetups, rapid and blitz sessions, all levels welcome." },
  { id: "gaming", slug: "gaming", label: "Gaming", emoji: "🎮", noun: "gaming nights", defaultCapacity: 8,
    blurb: "FIFA nights, console tournaments and LAN meetups in clubhouses and cafés." },
  { id: "running", slug: "running", label: "Running", emoji: "🏃", noun: "group runs", defaultCapacity: 20,
    blurb: "Morning group runs and weekend long runs with people in your area." },
  { id: "other", slug: "other", label: "Other", emoji: "🎯", noun: "games", defaultCapacity: 8,
    blurb: "Frisbee, kabaddi, board games — anything you can play together." },
];

export const SPORT_BY_ID = Object.fromEntries(SPORTS.map((s) => [s.id, s])) as Record<Sport, SportInfo>;
export const SPORT_BY_SLUG = Object.fromEntries(SPORTS.map((s) => [s.slug, s])) as Record<string, SportInfo>;
export const SPORT_IDS = SPORTS.map((s) => s.id) as [Sport, ...Sport[]];
