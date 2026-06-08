// ISO-8601 week helpers. Used by the RSS feed (to anchor whole-week items)
// and by the scrape-time staleness guard (last-known-good fallback may only
// reuse cached data from the *same* ISO week — a menu is weekly, so same-week
// cache is still correct, but last week's menu is not).

export function isoWeek(d: Date): { year: number; week: number } {
  // ISO 8601: the Thursday of the same week determines the year.
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: t.getUTCFullYear(), week };
}

/** True when both dates fall in the same ISO week (and ISO week-year). */
export function sameIsoWeek(a: Date, b: Date): boolean {
  const x = isoWeek(a);
  const y = isoWeek(b);
  return x.year === y.year && x.week === y.week;
}
