import * as cheerio from "cheerio";
import { DayMenu, ScrapedData, ScraperDescriptor } from "../types";
import { WEEKDAYS, weekdayLunch } from "../hours";
import { cleanText, fetchText } from "./lib";

const URL = "https://www.kantinlund.se/";
const DAYS = WEEKDAYS.map((d) => d.sv);
// Whole-week extras that run every weekday alongside the daily dish. Order
// here is the order they're prepended on each day.
const WEEKLY_EXTRAS = ["Veckans vegetariska", "Månadens alternativ"];
// Kantin: kitchen serves until 15:00 (building open till 16:00).
const HOURS = weekdayLunch("11:00", "15:00");

export function parseKantin(html: string): ScrapedData {
  const $ = cheerio.load(html);

  // The week heading looks like "Meny  18/5 – 22/5" — pull it out as the note.
  let note: string | undefined;
  $("h1, h2").each((_, el) => {
    const t = cleanText($(el).text());
    if (/^Meny\s/i.test(t)) {
      note = t;
      return false;
    }
  });

  // Each day is a <p> whose first child is a <strong>. Two shapes appear:
  //   <strong>Måndag </strong>dish text…
  //   <strong>Veckans vegetariska </strong>dish text…
  //   <strong>Månadens alternativ <span style="font-weight:400">dish…</span></strong>
  // The last one keeps the dish inside the strong via a non-bold span, so
  // peeking only at strong.text() isn't enough — match on the full paragraph
  // text against the known label prefixes. Skip paragraphs where the strong
  // is plain body text (e.g. "Måndag till fredag kl. 11–16").
  const menu: DayMenu[] = [];
  const extras = new Map<string, string>();
  $("p").each((_, p) => {
    const para = $(p);
    const strong = para.children("strong").first();
    if (!strong.length) return;
    if (para.contents().first().get(0) !== strong.get(0)) return;

    const full = cleanText(para.text());
    if (!full) return;

    const day = DAYS.find((d) =>
      new RegExp(`^${d}\\b`, "i").test(full),
    );
    if (day) {
      const rest = full.replace(new RegExp(`^${day}\\s+`, "i"), "").trim();
      if (rest) menu.push({ day, lines: [rest] });
      return;
    }

    for (const lbl of WEEKLY_EXTRAS) {
      const m = full.match(new RegExp(`^${lbl}\\s+(.+)$`, "i"));
      if (m) {
        extras.set(lbl, `${lbl}: ${m[1].trim()}`);
        break;
      }
    }
  });
  if (extras.size) {
    const prefix = WEEKLY_EXTRAS
      .map((l) => extras.get(l))
      .filter((s): s is string => !!s);
    for (const d of menu) d.lines = [...prefix, ...d.lines];
  }

  if (menu.length === 0) {
    throw new Error("kantin: no day paragraphs found");
  }

  return { note, menu, hours: HOURS };
}

export const kantin: ScraperDescriptor = {
  id: "kantin",
  name: "Kantin",
  address: "Brunnshögsgatan 14, Lund",
  website: URL,
  scrape: async () => parseKantin(await fetchText(URL, "kantin")),
};
