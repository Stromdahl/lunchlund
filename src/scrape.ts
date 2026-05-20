import { Restaurant, ScrapeResult } from "./types";
import { SCRAPERS } from "./scrapers";

export async function scrapeAll(): Promise<ScrapeResult> {
  const settled = await Promise.allSettled(SCRAPERS.map((s) => s.scrape()));
  const restaurants: Restaurant[] = settled.map((r, i) => {
    const d = SCRAPERS[i];
    const identity = { name: d.name, address: d.address, website: d.website };
    if (r.status === "fulfilled") {
      return { ...identity, ...r.value };
    }
    return {
      ...identity,
      menu: [],
      error: { source: d.id, error: String(r.reason?.message ?? r.reason) },
    };
  });
  return { fetchedAt: new Date(), restaurants };
}
