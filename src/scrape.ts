import { Restaurant, ScrapeResult } from "./types";
import { scrapeBricks } from "./scrapers/bricks";
import { scrapeEatery } from "./scrapers/eatery";
import { scrapeKantin } from "./scrapers/kantin";
import { scrapeEdison } from "./scrapers/edison";
import { scrapeInspira } from "./scrapers/inspira";

const SCRAPERS: { name: string; run: () => Promise<Restaurant> }[] = [
  { name: "bricks", run: scrapeBricks },
  { name: "eatery", run: scrapeEatery },
  { name: "kantin", run: scrapeKantin },
  { name: "edison", run: scrapeEdison },
  { name: "inspira", run: scrapeInspira },
];

export async function scrapeAll(): Promise<ScrapeResult> {
  const settled = await Promise.allSettled(SCRAPERS.map((s) => s.run()));
  const restaurants: Restaurant[] = [];
  const errors: { source: string; error: string }[] = [];

  settled.forEach((r, i) => {
    const source = SCRAPERS[i].name;
    if (r.status === "fulfilled") restaurants.push(r.value);
    else errors.push({ source, error: String(r.reason?.message ?? r.reason) });
  });

  return { fetchedAt: new Date(), restaurants, errors };
}
