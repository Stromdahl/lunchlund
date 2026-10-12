import * as cheerio from "cheerio";
import { DayMenu, ScrapedData, ScraperDescriptor } from "../types";
import { weekdayLunch } from "../hours";
import { cleanText, fetchText } from "./lib";

// cheerio doesn't re-export domhandler's node type and domhandler isn't a
// direct dependency (PnP won't resolve it), so lift it off load()'s signature.
type AnyNode = Exclude<Parameters<typeof cheerio.load>[0], string | Buffer | unknown[]>;

const URL = "https://www.troppo.se/lunch";
// Troppo posts a single weekly lunch menu of 3 dishes available all weekdays,
// not a different menu per day, so we represent it with one DayMenu under
// this label. The renderer special-cases non-weekday entries to show them as
// today's menu on any weekday.
const WHOLE_WEEK_LABEL = "Hela veckan";

// The dish description: the <br>-separated lines following a dish's <strong>
// within the same paragraph, up to the first blank line, an "or" divider, or
// the next named <strong>. Troppo has written it as an <em> after the strong
// (spring 2026) and as plain text with only the odd word in <em> (October
// 2026), so read text nodes rather than keying on the <em>. An empty <strong>
// (just a <br>) is layout, not a dish, so it's walked like any other wrapper.
function descriptionAfter(strong: AnyNode): string {
  const parts: string[] = [];
  let line = "";
  let done = false;
  const flush = () => {
    const t = cleanText(line);
    line = "";
    if (/^or$/i.test(t)) done = true;
    else if (t) parts.push(t);
    else if (parts.length) done = true;
  };
  const visit = (node: AnyNode) => {
    if (done) return;
    if (node.type === "text") line += node.data;
    else if (node.type === "tag") {
      if (node.name === "br") flush();
      else node.children.forEach(visit);
    }
  };
  for (let n = strong.nextSibling; n && !done; n = n.nextSibling) {
    if (n.type === "tag" && n.name === "strong" && cleanText(textOf(n))) break;
    visit(n);
  }
  if (!done) flush();
  return parts.join(" ");
}

function textOf(node: AnyNode): string {
  if (node.type === "text") return node.data;
  if (node.type === "tag") return node.children.map(textOf).join("");
  return "";
}

export function parseTroppo(html: string): ScrapedData {
  const $ = cheerio.load(html);

  // Week heading is "Lunch Week NN, YYYY".
  let note: string | undefined;
  $("h1").each((_, el) => {
    const t = cleanText($(el).text());
    if (/^Lunch Week/i.test(t)) {
      note = t;
      return false;
    }
  });

  // The price is a short <p> like "Lunch 149-159kr" right under the h1.
  let price: string | undefined;
  $("p").each((_, p) => {
    const t = cleanText($(p).text());
    const m = t.match(/^Lunch\s+([\d]+(?:\s*[-–]\s*\d+)?\s*kr)$/i);
    if (m) {
      price = m[1].replace(/\s*[-–]\s*/, "–").replace(/\s+/g, "");
      return false;
    }
  });

  // The menu lives in a .rich-text block somewhere after the "Monday-Friday"
  // h2 — usually nested one level inside the next sibling wrapper. Since
  // Troppo added Saturday lunch (October 2026) the h2 reads "Monday-Saturday".
  let container = $();
  $("h2").each((_, el) => {
    if (/Monday\s*-\s*(?:Friday|Saturday)/i.test($(el).text())) {
      container = $(el).nextAll().find(".rich-text").addBack(".rich-text").first();
      return false;
    }
  });
  if (!container.length) {
    throw new Error("troppo: could not locate Monday-Friday/Saturday menu block");
  }

  const lines: string[] = [];
  container.find("strong").each((_, strong) => {
    const name = cleanText($(strong).text()).replace(/\s*[-–]$/, "");
    if (!name || /^or$/i.test(name)) return;
    const desc = descriptionAfter(strong);
    lines.push(desc ? `${name} — ${desc}` : name);
  });

  const menu: DayMenu[] = lines.length
    ? [{ day: WHOLE_WEEK_LABEL, lines }]
    : [];

  return { note, price, menu, hours: weekdayLunch("11:00", "14:00") };
}

export const troppo: ScraperDescriptor = {
  id: "troppo",
  name: "Troppo",
  address: "Brunnshögsgatan 34, Lund",
  walkMinutes: 11,
  website: URL,
  scrape: async () => parseTroppo(await fetchText(URL, "troppo")),
};
