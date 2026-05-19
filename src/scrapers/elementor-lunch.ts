import * as cheerio from "cheerio";
import { Restaurant, DayMenu, WeeklyHours } from "../types";

// Bricks Eatery, Edison and Inspira all build their site on the same
// Elementor "lunchmeny" shortcode, so the markup is identical. The day
// containers are tagged with English weekday class names; inside, each dish
// is a .lunchmeny_container with a .lunch_title (category like "Green") and
// a .lunch_desc.
const DAY_CLASSES: { day: string; cls: string }[] = [
  { day: "Måndag", cls: "monday" },
  { day: "Tisdag", cls: "tuesday" },
  { day: "Onsdag", cls: "wednesday" },
  { day: "Torsdag", cls: "thursday" },
  { day: "Fredag", cls: "friday" },
];

export type ElementorLunchOpts = {
  url: string;
  name: string;
  address: string;
  hours?: WeeklyHours;
};

export async function scrapeElementorLunch(
  opts: ElementorLunchOpts,
): Promise<Restaurant> {
  const res = await fetch(opts.url, {
    headers: { "user-agent": "lunchlund/0.1 (+local tool)" },
  });
  if (!res.ok) {
    throw new Error(`${opts.name}: ${res.status} ${res.statusText}`);
  }
  const $ = cheerio.load(await res.text());

  const note = $(".week").first().text().replace(/\s+/g, " ").trim() || undefined;

  // The Elementor "lunchmeny" shortcode prints a .lunch_price per dish. Bricks
  // and Edison fill it with a single uniform price; Inspira leaves it blank.
  let price: string | undefined;
  $(".lunch_price").each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (t) {
      price = t;
      return false;
    }
  });

  const menu: DayMenu[] = [];
  for (const { day, cls } of DAY_CLASSES) {
    const lines: string[] = [];
    $(`.${cls} .lunchmeny_container`).each((_, el) => {
      const c = $(el);
      const title = c.find(".lunch_title").text().trim();
      const desc = c.find(".lunch_desc").text().trim().replace(/\s+/g, " ");
      if (!title && !desc) return;
      if (!desc) {
        lines.push(title);
        return;
      }
      lines.push(title ? `${title}: ${desc}` : desc);
    });
    if (lines.length) menu.push({ day, lines });
  }

  return {
    name: opts.name,
    address: opts.address,
    website: opts.url,
    note,
    price,
    menu,
    hours: opts.hours,
  };
}
