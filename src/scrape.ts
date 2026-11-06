import { readFile } from "node:fs/promises";
import { Restaurant, ScrapedData, ScrapeResult, ScraperDescriptor } from "./types";
import { SCRAPERS } from "./scrapers";
import { sameIsoWeek } from "./week";

type CacheEntry = Pick<Restaurant, "menu" | "note" | "price" | "hours" | "asOf">;

/** Read the previous run's JSON output from `path`, keyed by restaurant
 *  name. Never throws: a missing / empty / malformed file yields `null`, which
 *  collapses the fallback to an error card. */
export async function loadCache(
  path: string,
): Promise<Map<string, Restaurant> | null> {
  try {
    const data = JSON.parse(await readFile(path, "utf8")) as {
      restaurants?: Restaurant[];
    };
    if (!Array.isArray(data?.restaurants)) return null;
    const map = new Map<string, Restaurant>();
    for (const r of data.restaurants) {
      if (r && typeof r.name === "string") map.set(r.name, r);
    }
    return map;
  } catch {
    return null;
  }
}

/** Build the final Restaurant for one descriptor from its scrape outcome.
 *  On failure, fall back to a cached entry when it carries a real menu fetched
 *  in the *same ISO week* (so we never resurrect last week's menu). The cached
 *  `asOf` is preserved verbatim so the fallback chains across repeated failed
 *  builds without ever looking "fresh". Pure — no I/O. */
export function resolveRestaurant(
  d: ScraperDescriptor,
  outcome: PromiseSettledResult<ScrapedData>,
  cache: Map<string, Restaurant> | null,
  now: Date,
): Restaurant {
  const identity = {
    name: d.name,
    address: d.address,
    website: d.website,
    walkMinutes: d.walkMinutes,
  };

  if (outcome.status === "fulfilled") {
    return { ...identity, ...outcome.value, asOf: now.toISOString() };
  }

  const error = {
    source: d.id,
    error: String(outcome.reason?.message ?? outcome.reason),
  };

  const prev = cache?.get(d.name);
  if (
    prev &&
    prev.menu?.length &&
    prev.asOf &&
    sameIsoWeek(new Date(prev.asOf), now)
  ) {
    const data: CacheEntry = {
      menu: prev.menu,
      note: prev.note,
      price: prev.price,
      hours: prev.hours,
      asOf: prev.asOf, // preserve the original successful-fetch time
    };
    return { ...identity, ...data, stale: true, error };
  }

  return { ...identity, menu: [], error };
}

export async function scrapeAll(
  cachePath: string,
  now: Date = new Date(),
): Promise<ScrapeResult> {
  const settled = await Promise.allSettled(SCRAPERS.map((s) => s.scrape()));
  // Only read the cache when something actually failed.
  const cache = settled.some((r) => r.status === "rejected")
    ? await loadCache(cachePath)
    : null;
  const restaurants = settled.map((r, i) =>
    resolveRestaurant(SCRAPERS[i], r, cache, now),
  );
  return { fetchedAt: now, restaurants };
}
