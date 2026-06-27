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
  /** Estimated walking minutes from Mobilvägen 10. Static identity supplied by
   *  the descriptor (decided once, not scraped). Absent only on cache-parsed
   *  entries, so the renderer guards on its presence. */
  walkMinutes?: number;
  /** Free-form annotation shown under the name (e.g. "Lunchmeny V21"). */
  note?: string;
  /** Free-form lunch price as published by the site, e.g. "115:-",
   *  "139kr (early-bird 132 kr 11:00–11:30)", "149–159kr". */
  price?: string;
  menu: DayMenu[];
  hours?: WeeklyHours;
  /** Set when the restaurant is wholly closed today (e.g. a summer/holiday
   *  shutdown announced on the site). The scraper empties `menu` and `hours`
   *  so the card reads "Stängt idag" rather than showing a menu the kitchen
   *  isn't serving; `note` is the human-readable closure line, e.g.
   *  "Semesterstängt t.o.m. 9/8". */
  closed?: { note: string };
  /** ISO timestamp of the build that last fetched this menu *successfully*.
   *  Set on every successful scrape; preserved verbatim when a failed build
   *  falls back to this entry, so its age can be bounded across outages. */
  asOf?: string;
  /** True when this entry is last-known-good data shown because the fresh
   *  scrape failed. The menu is real (just not re-fetched today); `error`
   *  carries the latest failure reason. */
  stale?: boolean;
  /** Set when the scraper for this restaurant failed. Identity (name/address/
   *  website) still comes from the descriptor so the renderer can show a card.
   *  May coexist with a menu when `stale` is set (last-known-good fallback). */
  error?: { source: string; error: string };
};

/** What a scraper's parser produces — identity-free; the descriptor supplies
 *  identity, and the build manages `asOf`/`stale`/`error`. */
export type ScrapedData = Omit<
  Restaurant,
  "name" | "address" | "website" | "walkMinutes" | "asOf" | "stale" | "error"
>;

export type ScraperDescriptor = {
  id: string;
  name: string;
  address: string;
  website: string;
  /** Estimated walking minutes from Mobilvägen 10 (static, hand-set per site). */
  walkMinutes: number;
  scrape: () => Promise<ScrapedData>;
};

export type ScrapeResult = {
  fetchedAt: Date;
  restaurants: Restaurant[];
};
