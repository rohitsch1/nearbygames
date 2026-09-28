import { formatDistanceToNowStrict, isToday, isTomorrow, differenceInMinutes } from "date-fns";

// All user-facing times are shown in India time; the app targets Indian cities.
export const APP_TIMEZONE = "Asia/Kolkata";

const timeFmt = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: APP_TIMEZONE });
const dayFmt = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: APP_TIMEZONE });
const fullFmt = new Intl.DateTimeFormat("en-IN", {
  weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", hour12: true, timeZone: APP_TIMEZONE,
});

export function formatDistance(m: number | null | undefined) {
  if (m == null) return "";
  if (m < 1000) return `${Math.max(100, Math.round(m / 50) * 50)} m away`;
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km away`;
}

/** "Today, 6:30 pm" · "Tomorrow, 7:00 am" · "Sat 4 Oct, 5:00 pm" */
export function formatWhen(iso: string) {
  const d = new Date(iso);
  const t = timeFmt.format(d);
  // isToday/isTomorrow use the runtime's zone; compare using IST day strings instead.
  const dayKey = (x: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE }).format(x);
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86400000);
  if (dayKey(d) === dayKey(now)) return `Today, ${t}`;
  if (dayKey(d) === dayKey(tomorrow)) return `Tomorrow, ${t}`;
  return `${dayFmt.format(d)}, ${t}`;
}

export function formatFullDate(iso: string) {
  return fullFmt.format(new Date(iso));
}

/** "in 25 min" · "in 2 h" · "started" */
export function formatStartsIn(iso: string) {
  const mins = differenceInMinutes(new Date(iso), new Date());
  if (mins <= 0) return "started";
  if (mins < 60) return `in ${mins} min`;
  if (mins < 60 * 24) return `in ${Math.round(mins / 60)} h`;
  return `in ${Math.round(mins / 1440)} d`;
}

export function timeAgo(iso: string) {
  return formatDistanceToNowStrict(new Date(iso), { addSuffix: false })
    .replace(" seconds", "s").replace(" second", "s")
    .replace(" minutes", "m").replace(" minute", "m")
    .replace(" hours", "h").replace(" hour", "h")
    .replace(" days", "d").replace(" day", "d");
}

export function firstName(name: string | null | undefined, fallback = "Player") {
  return name?.trim().split(/\s+/)[0] || fallback;
}

export function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

// Re-exported so pages don't need date-fns directly.
export { isToday, isTomorrow };
