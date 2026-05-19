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

const WEEKDAY_NAMES_SV: Record<WeekdayKey, string> = {
  mon: "Måndag",
  tue: "Tisdag",
  wed: "Onsdag",
  thu: "Torsdag",
  fri: "Fredag",
  sat: "Lördag",
  sun: "Söndag",
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
  return WEEKDAY_NAMES_SV[key];
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
