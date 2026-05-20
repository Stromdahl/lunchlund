import * as cheerio from "cheerio";
import { DayMenu, ScrapedData, WeeklyHours } from "../types";
import { WEEKDAYS } from "../hours";
import { cleanText, fetchText } from "./lib";

// Bricks Eatery, Edison and Inspira all build their site on the same
// Elementor "lunchmeny" shortcode, so the markup is identical. The day
// containers are tagged with English weekday class names; inside, each dish
// is a .lunchmeny_container with a .lunch_title (category like "Green") and
// a .lunch_desc.

export type ElementorLunchOpts = {
  /** Static opening hours; the page doesn't publish them. */
  hours?: WeeklyHours;
};

export function parseElementorLunch(
  html: string,
  opts: ElementorLunchOpts = {},
): ScrapedData {
  const $ = cheerio.load(html);

  const note = cleanText($(".week").first().text()) || undefined;

  // The Elementor "lunchmeny" shortcode prints a .lunch_price per dish. Bricks
  // and Edison fill it with a single uniform price; Inspira leaves it blank.
  let price: string | undefined;
  $(".lunch_price").each((_, el) => {
    const t = cleanText($(el).text());
    if (t) {
      price = t;
      return false;
    }
  });

  const menu: DayMenu[] = [];
  for (const { sv: day, en: cls } of WEEKDAYS) {
    const lines: string[] = [];
    $(`.${cls} .lunchmeny_container`).each((_, el) => {
      const c = $(el);
      const title = cleanText(c.find(".lunch_title").text());
      const desc = cleanText(c.find(".lunch_desc").text());
      if (!title && !desc) return;
      if (!desc) {
        lines.push(title);
        return;
      }
      lines.push(title ? `${title}: ${desc}` : desc);
    });
    if (lines.length) menu.push({ day, lines });
  }

  return { note, price, menu, hours: opts.hours };
}

export async function scrapeElementorLunch(
  url: string,
  label: string,
  opts: ElementorLunchOpts = {},
): Promise<ScrapedData> {
  return parseElementorLunch(await fetchText(url, label), opts);
}
