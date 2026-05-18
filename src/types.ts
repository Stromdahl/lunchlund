export type DayMenu = {
  day: string;
  lines: string[];
};

export type Restaurant = {
  name: string;
  address: string;
  website?: string;
  /** Free-form annotation shown under the name (e.g. "Lunchmeny V21"). */
  note?: string;
  menu: DayMenu[];
};

export type ScrapeResult = {
  fetchedAt: Date;
  restaurants: Restaurant[];
  errors: { source: string; error: string }[];
};
