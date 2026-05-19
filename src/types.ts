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
  /** Free-form lunch price as published by the site, e.g. "115:-",
   *  "139kr (early-bird 132 kr 11:00–11:30)", "149–159kr". */
  price?: string;
  menu: DayMenu[];
  hours?: WeeklyHours;
};

export type ScrapeResult = {
  fetchedAt: Date;
  restaurants: Restaurant[];
  errors: { source: string; error: string }[];
};
