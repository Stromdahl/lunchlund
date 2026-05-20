import { OpeningInterval, WeekdayKey, WeeklyHours } from "./types";

export type DaySpec = {
  key: WeekdayKey;
  /** Title-case Swedish: "Måndag" */
  sv: string;
  /** Upper-case Swedish: "MÅNDAG" */
  svUpper: string;
  /** Lower-case English: "monday" (used as CSS class by Elementor sites). */
  en: string;
};

export const DAYS: readonly DaySpec[] = [
  { key: "mon", sv: "Måndag", svUpper: "MÅNDAG", en: "monday" },
  { key: "tue", sv: "Tisdag", svUpper: "TISDAG", en: "tuesday" },
  { key: "wed", sv: "Onsdag", svUpper: "ONSDAG", en: "wednesday" },
  { key: "thu", sv: "Torsdag", svUpper: "TORSDAG", en: "thursday" },
  { key: "fri", sv: "Fredag", svUpper: "FREDAG", en: "friday" },
  { key: "sat", sv: "Lördag", svUpper: "LÖRDAG", en: "saturday" },
  { key: "sun", sv: "Söndag", svUpper: "SÖNDAG", en: "sunday" },
];

export const WEEKDAYS: readonly DaySpec[] = DAYS.slice(0, 5);

export const WEEKDAY_KEYS: WeekdayKey[] = DAYS.map((d) => d.key);

const BY_KEY: Record<WeekdayKey, DaySpec> = Object.fromEntries(
  DAYS.map((d) => [d.key, d]),
) as Record<WeekdayKey, DaySpec>;

const BY_SV_LOWER: Record<string, WeekdayKey> = Object.fromEntries(
  DAYS.map((d) => [d.sv.toLowerCase(), d.key]),
);

/** "Måndag" for key "mon". */
export function daySv(key: WeekdayKey): string {
  return BY_KEY[key].sv;
}

/** WeekdayKey for "Måndag" / "måndag" / "MÅNDAG". Returns undefined if not a Swedish day. */
export function keyFromSv(sv: string): WeekdayKey | undefined {
  return BY_SV_LOWER[sv.trim().toLowerCase()];
}

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
