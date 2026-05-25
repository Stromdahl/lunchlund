import * as cheerio from "cheerio";
import { DayMenu, ScrapedData, ScraperDescriptor } from "../types";
import { weekdayLunch } from "../hours";
import { cleanText, fetchText } from "./lib";

const URL = "https://www.aikosushi.se/lunch";
const WHOLE_WEEK_LABEL = "Hela veckan";

// Aiko publishes a fixed lunch menu — same four categories Mon–Fri at every
// branch, only the prices vary now and then. We model it like Troppo/Laziza:
// one DayMenu labelled "Hela veckan". The page is parsed to confirm the four
// category H2s are still there; the line strings themselves are curated,
// since the page is mostly fixed-form copy + price tables.
export function parseAiko(html: string): ScrapedData {
  const $ = cheerio.load(html);

  const hasH2 = (re: RegExp): boolean =>
    $("h2")
      .toArray()
      .some((el) => re.test(cleanText($(el).text())));

  if (!hasH2(/lunch\s*erbjudande/i)) {
    throw new Error("aiko: missing 'Lunch Erbjudande' heading");
  }
  const required = ["Sushi", "Sushi Dog", "Varmrätter", "Poké"];
  for (const name of required) {
    const re = new RegExp(name.replace(/\s+/g, "\\s+"), "i");
    if (!hasH2(re)) throw new Error(`aiko: missing menu section '${name}'`);
  }

  // The lead paragraph: "Inkl. misosoppa, vatten & kaffe (...)". We only keep
  // the part before the parenthetical so the renderer's small note pill stays
  // short.
  let note: string | undefined;
  $("p").each((_, el) => {
    const t = cleanText($(el).text());
    if (/inkl\.?\s*misosoppa/i.test(t)) {
      note = t.replace(/\s*\(.*$/, "").trim();
      return false;
    }
  });

  const hasHoursLine = $("p")
    .toArray()
    .some((el) => {
      const t = cleanText($(el).text());
      return /måndag\s*[-–]\s*fredag/i.test(t) && /11:00/.test(t);
    });
  if (!hasHoursLine) throw new Error("aiko: hours line not found");

  const lines = [
    "Mixad sushi: 109/129/149kr (11/13/16 bitar) · finns vegetarisk",
    "Mixad nigiri: 119/139kr (9/12 bitar) · finns vegetarisk",
    "Sushi Dog: 80kr to-go / 95kr eat-in · 8 fyllningar att välja",
    "Varmrätt: wokade udon nudlar 119kr (kyckling eller tofu)",
    "Poké Bowl: 129kr kall / 139kr varm",
  ];

  const menu: DayMenu[] = [{ day: WHOLE_WEEK_LABEL, lines }];

  return {
    note,
    price: "80–149kr",
    menu,
    hours: weekdayLunch("11:00", "14:30"),
  };
}

export const aiko: ScraperDescriptor = {
  id: "aiko",
  name: "Aiko Sushi Brunnshög",
  address: "Systemeraregatan 3, Lund",
  website: URL,
  scrape: async () => parseAiko(await fetchText(URL, "aiko")),
};
