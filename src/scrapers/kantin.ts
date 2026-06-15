import * as cheerio from "cheerio";
import { DayMenu, ScrapedData, ScraperDescriptor } from "../types";
import { WEEKDAYS, weekdayLunch } from "../hours";
import { cleanText, fetchText } from "./lib";

const URL = "https://www.kantinlund.se/";
const DAYS = WEEKDAYS.map((d) => d.sv);
// Whole-week extras that run every weekday alongside the daily dish. Order
// here is the order they're prepended on each day.
const WEEKLY_EXTRAS = ["Veckans vegetariska", "Månadens alternativ"];
// A closed day serves none of the weekly extras, so its line should stand alone
// rather than listing veg / månadens dishes above a closed note. "stängt" is the
// overwhelmingly common phrasing (Midsommarstängt, Helgstängt, Stängt pga …),
// but #8 noted closed days worded without that stem slip through. So also match
// the other unambiguous "no service" signals: a public-holiday label (röd dag /
// helgdag) or an explicit "ingen lunch/servering/mat". A bare "klämdag" is left
// out — a bridge day can still serve lunch, and any closed one says so via the
// other stems (e.g. "Klämdag – ingen lunch"). The holiday labels carry a
// trailing \b so a compound that merely starts with them — "röd dagsfärsk lax",
// "helgdagsöppet" (the opposite, *open* on holidays) — doesn't read as closed.
const CLOSED_DAY =
  /stängt|stängd|röd\s*dag\b|helgdag\b|ingen\s+(?:lunch|servering|mat)/i;
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

  // Each day is a <p> whose leading bold text is a day label. Shapes seen:
  //   <strong>Måndag </strong>dish text…
  //   <strong>Veckans vegetariska </strong>dish text…
  //   <strong>Månadens alternativ <span style="font-weight:400">dish…</span></strong>
  //   <p><span…><span…><strong>måndag</strong> – dish text…</span></p>
  // The last shape (content pasted from webmail) wraps the bold in nested
  // <span>s and separates the dish with an en-dash, so it isn't a direct child
  // and the day name is lowercased. Webmail/Word paste also emits <b> as often
  // as <strong>, so accept either. Find the bold anywhere in the paragraph and
  // require its text to lead the paragraph — that skips body paragraphs where a
  // day word isn't bold (e.g. the theme's "Måndag till fredag kl. 11–16" hours
  // line) and the contact line's bolded <b>info@…</b> email. Match on the full
  // paragraph text since Månadens keeps its dish inside the strong via a
  // non-bold span.
  const menu: DayMenu[] = [];
  const extras = new Map<string, string>();
  $("p").each((_, p) => {
    const para = $(p);
    const bold = para.find("strong, b").first();
    if (!bold.length) return;

    const full = cleanText(para.text());
    if (!full) return;
    const lead = cleanText(bold.text());
    if (!lead || !full.startsWith(lead)) return;

    const day = DAYS.find((d) =>
      new RegExp(`^${d}\\b`, "i").test(full),
    );
    if (day) {
      // Strip the day label and any following separator: whitespace, colon, or
      // any hyphen/dash variant (ASCII -, U+2010–2015, minus sign U+2212).
      const rest = full
        .replace(new RegExp(`^${day}[\\s:\\u2010-\\u2015\\u2212-]+`, "i"), "")
        .trim();
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
    for (const d of menu) {
      // A closed day (e.g. "fredag – Midsommarstängt" on a holiday week) serves
      // none of the weekly extras, so let its line stand alone rather than
      // listing veg / månadens dishes above a closed note. See CLOSED_DAY.
      if (d.lines.some((l) => CLOSED_DAY.test(l))) continue;
      d.lines = [...prefix, ...d.lines];
    }
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
  walkMinutes: 7,
  website: URL,
  scrape: async () => parseKantin(await fetchText(URL, "kantin")),
};
