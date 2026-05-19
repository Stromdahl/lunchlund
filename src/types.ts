export type DayMenu = {
  day: string;
  lines: string[];
};

export type WeekdayKey =
  | "mon"
  | "tue"
  | "wed"
  | "thu"
  | "fri"
  | "sat"
  | "sun";

export type OpeningInterval = { open: string; close: string }; // "HH:MM"
export type WeeklyHours = Record<WeekdayKey, OpeningInterval[]>;

export type Restaurant = {
  name: string;
  address: string;
  website?: string;
  /** Free-form annotation shown under the name (e.g. "Lunchmeny V21"). */
  note?: string;
  menu: DayMenu[];
  hours?: WeeklyHours;
};

export type ScrapeResult = {
  fetchedAt: Date;
  restaurants: Restaurant[];
  errors: { source: string; error: string }[];
};
