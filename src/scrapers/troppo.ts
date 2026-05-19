import * as cheerio from "cheerio";
import { Restaurant, DayMenu } from "../types";
import { weekdayLunch } from "../hours";

const URL = "https://www.troppo.se/lunch";
// Troppo posts a single weekly lunch menu of 3 dishes available all weekdays,
// not a different menu per day, so we represent it with one DayMenu under
// this label. The renderer special-cases non-weekday entries to show them as
// today's menu on any weekday.
const WHOLE_WEEK_LABEL = "Hela veckan";

export async function scrapeTroppo(): Promise<Restaurant> {
  const res = await fetch(URL, {
    headers: { "user-agent": "lunchlund/0.1 (+local tool)" },
  });
  if (!res.ok) throw new Error(`troppo: ${res.status} ${res.statusText}`);
  const $ = cheerio.load(await res.text());

  // Week heading is "Lunch Week NN, YYYY".
  let note: string | undefined;
  $("h1").each((_, el) => {
    const t = $(el).text().replace(/[​-‍﻿]/g, "").replace(/\s+/g, " ").trim();
    if (/^Lunch Week/i.test(t)) {
      note = t;
      return false;
    }
  });

  // The price is a short <p> like "Lunch 149-159kr" right under the h1.
  let price: string | undefined;
  $("p").each((_, p) => {
    const t = $(p).text().replace(/[​-‍﻿]/g, "").replace(/\s+/g, " ").trim();
    const m = t.match(/^Lunch\s+([\d]+(?:\s*[-–]\s*\d+)?\s*kr)$/i);
    if (m) {
      price = m[1].replace(/\s*[-–]\s*/, "–").replace(/\s+/g, "");
      return false;
    }
  });

  // The menu lives in a .rich-text block somewhere after the "Monday-Friday"
  // h2 — usually nested one level inside the next sibling wrapper.
  let container = $();
  $("h2").each((_, el) => {
    if (/Monday\s*-\s*Friday/i.test($(el).text())) {
      container = $(el).nextAll().find(".rich-text").addBack(".rich-text").first();
      return false;
    }
  });
  if (!container.length) {
    throw new Error("troppo: could not locate Monday-Friday menu block");
  }

  const lines: string[] = [];
  container.find("strong").each((_, strong) => {
    const name = $(strong).text().replace(/[​-‍﻿]/g, "").replace(/\s+/g, " ").trim();
    if (!name || /^or$/i.test(name)) return;
    // Find the first non-empty <em> sibling after the strong, in document order.
    let desc = "";
    let cursor = $(strong).next();
    while (cursor.length && !desc) {
      if (cursor.is("em")) {
        const t = cursor.text().replace(/[​-‍﻿]/g, "").replace(/\s+/g, " ").trim();
        if (t) desc = t;
      }
      cursor = cursor.next();
    }
    lines.push(desc ? `${name} — ${desc}` : name);
  });

  const menu: DayMenu[] = lines.length
    ? [{ day: WHOLE_WEEK_LABEL, lines }]
    : [];

  return {
    name: "Troppo",
    address: "Brunnshögsgatan 34, Lund",
    website: URL,
    note,
    price,
    menu,
    hours: weekdayLunch("11:00", "14:00"),
  };
}
