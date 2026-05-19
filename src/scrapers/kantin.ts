import * as cheerio from "cheerio";
import { Restaurant, DayMenu } from "../types";
import { weekdayLunch } from "../hours";

const URL = "https://www.kantinlund.se/";
const DAYS = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag"];
// Kantin: kitchen serves until 15:00 (building open till 16:00).
const HOURS = weekdayLunch("11:00", "15:00");

export async function scrapeKantin(): Promise<Restaurant> {
  const res = await fetch(URL, {
    headers: { "user-agent": "lunchlund/0.1 (+local tool)" },
  });
  if (!res.ok) throw new Error(`kantin: ${res.status} ${res.statusText}`);
  const $ = cheerio.load(await res.text());

  // The week heading looks like "Meny  18/5 – 22/5" — pull it out as the note.
  let note: string | undefined;
  $("h1, h2").each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (/^Meny\s/i.test(t)) {
      note = t;
      return false;
    }
  });

  // Each day is a <p> whose first child is a <strong> with just the day name,
  // followed by the dish text. Skip paragraphs where the day name is plain
  // body text (e.g. "Måndag till fredag kl. 11–16").
  const menu: DayMenu[] = [];
  $("p").each((_, p) => {
    const para = $(p);
    const strong = para.children("strong").first();
    if (!strong.length) return;
    if (para.contents().first().get(0) !== strong.get(0)) return;
    const dayRaw = strong.text().trim();
    const day = DAYS.find((d) => d.toLowerCase() === dayRaw.toLowerCase());
    if (!day) return;

    const clone = para.clone();
    clone.children("strong").first().remove();
    const dish = clone.text().replace(/\s+/g, " ").trim();
    if (!dish) return;
    menu.push({ day, lines: [dish] });
  });

  return {
    name: "Kantin",
    address: "Brunnshögsgatan 14, Lund",
    website: URL,
    note,
    menu,
    hours: HOURS,
  };
}
