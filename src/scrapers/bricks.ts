import * as cheerio from "cheerio";
import { Restaurant, DayMenu } from "../types";

const URL = "https://brickseatery.se/";
const DAY_CLASSES: { day: string; cls: string }[] = [
  { day: "Måndag", cls: "monday" },
  { day: "Tisdag", cls: "tuesday" },
  { day: "Onsdag", cls: "wednesday" },
  { day: "Torsdag", cls: "thursday" },
  { day: "Fredag", cls: "friday" },
];

export async function scrapeBricks(): Promise<Restaurant> {
  const res = await fetch(URL, {
    headers: { "user-agent": "lunchlund/0.1 (+local tool)" },
  });
  if (!res.ok) throw new Error(`brickseatery: ${res.status} ${res.statusText}`);
  const $ = cheerio.load(await res.text());

  const week = $("h2.week").first().text().trim() || undefined;

  const menu: DayMenu[] = [];
  for (const { day, cls } of DAY_CLASSES) {
    const lines: string[] = [];
    $(`.${cls} .lunchmeny_container`).each((_, el) => {
      const c = $(el);
      const title = c.find(".lunch_title").text().trim();
      const desc = c.find(".lunch_desc").text().trim().replace(/\s+/g, " ");
      if (!desc) return;
      lines.push(title ? `${title}: ${desc}` : desc);
    });
    if (lines.length) menu.push({ day, lines });
  }

  return {
    name: "Bricks Eatery",
    address: "Mobilvägen 12, Lund",
    website: URL,
    note: week,
    menu,
  };
}
