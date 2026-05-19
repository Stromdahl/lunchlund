import { OpeningInterval, WeekdayKey, WeeklyHours } from "./types";

export const WEEKDAY_KEYS: WeekdayKey[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
];

const WEEKDAY_NAMES_EN: Record<WeekdayKey, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

// Map the Swedish day labels that the scrapers extract (Måndag, Tisdag, …)
// back to their WeekdayKey so the renderer can translate them.
const SV_TO_KEY: Record<string, WeekdayKey> = {
  måndag: "mon",
  tisdag: "tue",
  onsdag: "wed",
  torsdag: "thu",
  fredag: "fri",
  lördag: "sat",
  söndag: "sun",
};

/** Convenience: same lunch interval on weekdays, closed weekends. */
export function weekdayLunch(open: string, close: string): WeeklyHours {
  const w: OpeningInterval[] = [{ open, close }];
  return {
    mon: w,
    tue: w,
    wed: w,
    thu: w,
    fri: w,
    sat: [],
    sun: [],
  };
}

export function weekdayName(key: WeekdayKey): string {
  return WEEKDAY_NAMES_EN[key];
}

/** Translate a Swedish day label (as scraped) to English. Returns the input
 *  unchanged if no mapping is known (e.g. "Veckans"). */
export function translateDay(swedish: string): string {
  const key = SV_TO_KEY[swedish.trim().toLowerCase()];
  return key ? WEEKDAY_NAMES_EN[key] : swedish;
}

/** Extract day-of-week + HH:MM in Europe/Stockholm from a Date. */
export function stockholmDayAndTime(d: Date): {
  day: WeekdayKey;
  hhmm: string;
} {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Stockholm",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hh = parts.find((p) => p.type === "hour")?.value ?? "00";
  const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
  const key = wd.toLowerCase().slice(0, 3) as WeekdayKey;
  return { day: key, hhmm: `${hh}:${mm}` };
}

export function formatInterval(i: OpeningInterval): string {
  return `${i.open}–${i.close}`;
}
