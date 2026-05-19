import { Restaurant, ScrapeResult } from "./types";
import { scrapeBricks } from "./scrapers/bricks";
import { scrapeEatery } from "./scrapers/eatery";
import { scrapeKantin } from "./scrapers/kantin";
import { scrapeEdison } from "./scrapers/edison";
import { scrapeInspira } from "./scrapers/inspira";
import { scrapeTroppo } from "./scrapers/troppo";

// A scraper failure should still leave the restaurant visible on the page so
// the renderer can show an in-place "scrape failed" card instead of a top
// banner. We keep a small static fallback per source for that case.
type SourceStub = Pick<Restaurant, "name" | "address" | "website">;

type Source = {
  id: string;
  stub: SourceStub;
  run: () => Promise<Restaurant>;
};

const SOURCES: Source[] = [
  {
    id: "bricks",
    stub: {
      name: "Bricks Eatery",
      address: "Mobilvägen 12, Lund",
      website: "https://brickseatery.se/",
    },
    run: scrapeBricks,
  },
  {
    id: "eatery",
    stub: {
      name: "Eatery Lund",
      address: "Mobilvägen 4, Lund",
      website: "https://eatery.se/anlaggningar/lund",
    },
    run: scrapeEatery,
  },
  {
    id: "kantin",
    stub: {
      name: "Kantin",
      address: "Brunnshögsgatan 14, Lund",
      website: "https://www.kantinlund.se/",
    },
    run: scrapeKantin,
  },
  {
    id: "edison",
    stub: {
      name: "Restaurang Edison",
      address: "Emdalavägen 6B, Lund",
      website: "https://restaurangedison.se/",
    },
    run: scrapeEdison,
  },
  {
    id: "inspira",
    stub: {
      name: "Restaurang & Café Inspira",
      address: "Scheelevägen 4, Lund",
      website: "https://restauranginspira.se/",
    },
    run: scrapeInspira,
  },
  {
    id: "troppo",
    stub: {
      name: "Troppo",
      address: "Brunnshögsgatan 34, Lund",
      website: "https://www.troppo.se/lunch",
    },
    run: scrapeTroppo,
  },
];

export async function scrapeAll(): Promise<ScrapeResult> {
  const settled = await Promise.allSettled(SOURCES.map((s) => s.run()));
  const restaurants: Restaurant[] = [];
  const errors: { source: string; error: string }[] = [];

  settled.forEach((r, i) => {
    const source = SOURCES[i].id;
    if (r.status === "fulfilled") {
      restaurants.push(r.value);
    } else {
      restaurants.push({ ...SOURCES[i].stub, menu: [] });
      errors.push({ source, error: String(r.reason?.message ?? r.reason) });
    }
  });

  return { fetchedAt: new Date(), restaurants, errors };
}
