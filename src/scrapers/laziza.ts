import * as cheerio from "cheerio";
import { Restaurant, DayMenu } from "../types";
import { weekdayLunch } from "../hours";
import { cleanText, fetchText } from "./lib";

const URL = "https://www.laziza.se/lunch/";
// Laziza is a Lebanese buffet — same offer every weekday, no per-day menu —
// so we represent it the same way as Troppo: one DayMenu with a non-weekday
// label that the renderer treats as "today and the whole week".
const WHOLE_WEEK_LABEL = "Hela veckan";

export function parseLaziza(html: string): Restaurant {
  const $ = cheerio.load(html);

  // The page header block has:
  //   <h1>Lunch</h1>
  //   <h3>Libanesisk lunchbuffé,<br/>måndag till fredag</h3>
  //   <p>Laziza Baltzars: ...<br/>...Laziza Lund: 11:00 — 14:00</p>
  //   <h2>145 kr / 115 kr (take away)</h2>
  let buffet: string | undefined;
  $("h3").each((_, el) => {
    const t = cleanText($(el).text());
    if (/lunchbuff/i.test(t)) {
      // The h3 reads "Libanesisk lunchbuffé, måndag till fredag" — drop the
      // weekday tail; the renderer already prints "Samma meny mån–fre." above.
      buffet = t.replace(/\s*,\s*måndag till fredag\s*$/i, "");
      return false;
    }
  });
  if (!buffet) {
    throw new Error("laziza: could not find lunchbuffé heading");
  }

  let price: string | undefined;
  $("h2").each((_, el) => {
    const t = cleanText($(el).text());
    if (/\bkr\b/i.test(t) && !/boka/i.test(t)) {
      price = t;
      return false;
    }
  });

  const menu: DayMenu[] = [{ day: WHOLE_WEEK_LABEL, lines: [buffet] }];

  return {
    name: "Laziza",
    address: "Scheelevägen 15K, Lund",
    website: URL,
    price,
    menu,
    hours: weekdayLunch("11:00", "14:00"),
  };
}

export async function scrapeLaziza(): Promise<Restaurant> {
  return parseLaziza(await fetchText(URL, "laziza"));
}
