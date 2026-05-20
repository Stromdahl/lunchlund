import * as cheerio from "cheerio";
import { Restaurant, DayMenu } from "../types";
import { weekdayLunch } from "../hours";

const URL = "https://www.laziza.se/lunch/";
// Laziza is a Lebanese buffet — same offer every weekday, no per-day menu —
// so we represent it the same way as Troppo: one DayMenu with a non-weekday
// label that the renderer treats as "today and the whole week".
const WHOLE_WEEK_LABEL = "Hela veckan";

export async function scrapeLaziza(): Promise<Restaurant> {
  const res = await fetch(URL, {
    headers: { "user-agent": "lunchlund/0.1 (+local tool)" },
  });
  if (!res.ok) throw new Error(`laziza: ${res.status} ${res.statusText}`);
  const $ = cheerio.load(await res.text());

  // The page header block has:
  //   <h1>Lunch</h1>
  //   <h3>Libanesisk lunchbuffé,<br/>måndag till fredag</h3>
  //   <p>Laziza Baltzars: ...<br/>...Laziza Lund: 11:00 — 14:00</p>
  //   <h2>145 kr / 115 kr (take away)</h2>
  let buffet: string | undefined;
  $("h3").each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
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
    const t = $(el).text().replace(/\s+/g, " ").trim();
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
