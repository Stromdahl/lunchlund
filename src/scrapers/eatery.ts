import * as cheerio from "cheerio";
import { DayMenu, ScrapedData, ScraperDescriptor } from "../types";
import { WEEKDAYS, weekdayLunch } from "../hours";
import { isoWeek } from "../week";
import { cleanText, fetchJson, fetchText } from "./lib";

const HOURS = weekdayLunch("11:00", "14:00");

const PAGE_URL = "https://eatery.se/anlaggningar/lund";

// Since October 2026 Eatery publishes its lunch menu through Pej Menu Display
// (https://menu.pej.io/ea/menus/lund) instead of a weekly PDF. That page is an
// Angular app reading Firestore in the browser; Pej has no public API, so we
// read the same Firestore documents over its REST API with the web key the
// app itself ships (public by design — access is governed by Firestore rules).
// The data model is Pej's internal one and can change without notice:
//   organizations/{ORG_ID}            .menus[] — one per site; ours has
//                                      slug "lund" and `entries` keyed by
//                                      "YYYY-MM-DD", each with
//                                      informationBlocks[].libraryItemId or
//                                      status "Closed"
//   organizations/{ORG_ID}/items/{id} .name.sv / .description.sv
const FIRESTORE_DB = "projects/pej-menu-display/databases/(default)/documents";
const FIRESTORE = `https://firestore.googleapis.com/v1/${FIRESTORE_DB}`;
const API_KEY = "AIzaSyCEfYFjJkT4DcKk4GDOp9wfeJbvUqtVu3U";
// Eatery's Pej organisation (slug "ea"). A document id, stable across renames.
const ORG_ID = "yKtLIyA7nVuIA6Xh9f8k";
const MENU_SLUG = "lund";

async function scrapeEatery(): Promise<ScrapedData> {
  const now = new Date();
  // The org document carries every Eatery site's menus (~1.5 MB); the field
  // mask keeps it to `menus`, which is nearly all of it but skips the TV
  // display configs.
  const org = await fetchJson(
    `${FIRESTORE}/organizations/${ORG_ID}?mask.fieldPaths=menus&key=${API_KEY}`,
    "eatery menu",
  );
  const week = parseEateryWeek(org, now);
  const ids = [...new Set(week.days.flatMap((d) => d.itemIds))];
  const items = ids.length
    ? await fetchJson(`${FIRESTORE}:batchGet?key=${API_KEY}`, "eatery dishes", {
        documents: ids.map((id) => `${FIRESTORE_DB}/organizations/${ORG_ID}/items/${id}`),
      })
    : [];
  const menu = buildEateryMenu(week, parseEateryItems(items));
  // The price only lives on eatery.se. It's optional metadata, so a failed
  // landing-page fetch costs the price, not the card.
  const price = await fetchText(PAGE_URL, "eatery page")
    .then(parseEateryPrice)
    .catch(() => undefined);
  return { note: week.note, price, menu, hours: HOURS };
}

export const eatery: ScraperDescriptor = {
  id: "eatery",
  name: "Eatery Lund",
  address: "Mobilvägen 4, Lund",
  walkMinutes: 2,
  website: PAGE_URL,
  scrape: scrapeEatery,
};

export type EateryWeek = {
  note: string;
  days: { day: string; itemIds: string[]; closed: boolean }[];
};
export type EateryItem = { name: string; description?: string };

/** Pick this ISO week's Mon–Fri entries out of the Pej organisation document
 *  (Firestore REST shape). Days with no entry are left out. Throws when the
 *  "lund" menu is missing — a layout change on Pej's side. */
export function parseEateryWeek(orgDoc: unknown, now: Date): EateryWeek {
  const org = firestoreFields(orgDoc);
  const menus = Array.isArray(org.menus) ? org.menus : [];
  const lund = menus.find((m) => isRecord(m) && m.slug === MENU_SLUG);
  if (!isRecord(lund)) throw new Error(`eatery: no "${MENU_SLUG}" menu in Pej data`);
  const entries = isRecord(lund.entries) ? lund.entries : {};

  const days: EateryWeek["days"] = [];
  weekDates(now).forEach((date, i) => {
    const entry = entries[date];
    if (!isRecord(entry)) return;
    const blocks = Array.isArray(entry.informationBlocks) ? entry.informationBlocks : [];
    const itemIds = blocks
      .map((b) => (isRecord(b) ? b.libraryItemId : undefined))
      .filter((id): id is string => typeof id === "string");
    days.push({ day: WEEKDAYS[i].sv, itemIds, closed: entry.status === "Closed" });
  });
  return { note: `Lunchmeny V${isoWeek(stockholmDate(now)).week}`, days };
}

/** Dish name + description by item id, from a Firestore batchGet response.
 *  Missing documents are skipped. */
export function parseEateryItems(batch: unknown): Map<string, EateryItem> {
  const items = new Map<string, EateryItem>();
  for (const res of Array.isArray(batch) ? batch : []) {
    if (!isRecord(res) || !isRecord(res.found)) continue;
    const id = String(res.found.name ?? "").split("/").pop();
    const f = firestoreFields(res.found);
    const name = cleanText(svText(f.name));
    if (!id || !name) continue;
    const description = cleanText(svText(f.description)) || undefined;
    items.set(id, { name, description });
  }
  return items;
}

/** Join the week's days with their dishes. A closed day reads "Stängt"; a day
 *  whose dishes can't be resolved is dropped. Throws if nothing is left, so an
 *  empty week shows as an error card rather than a blank one. */
export function buildEateryMenu(
  week: EateryWeek,
  items: Map<string, EateryItem>,
): DayMenu[] {
  const menu: DayMenu[] = [];
  for (const d of week.days) {
    if (d.closed) {
      menu.push({ day: d.day, lines: ["Stängt"] });
      continue;
    }
    const lines = d.itemIds
      .map((id) => items.get(id))
      .filter((it): it is EateryItem => !!it)
      .map((it) => (it.description ? `${it.name} — ${it.description}` : it.name));
    if (lines.length) menu.push({ day: d.day, lines });
  }
  if (!menu.some((d) => d.lines[0] !== "Stängt")) {
    throw new Error(`eatery: no dishes for ${week.note}`);
  }
  return menu;
}

/** The lunch price from the eatery.se landing page, which lists two prices in
 *  adjacent <p>'s:
 *    "11:00 - 11:30 (Early-bird)\n132kr"
 *    "11:00 - 14:00 (ordinarie)\n139kr"
 *  joined into one display string. */
export function parseEateryPrice(html: string): string | undefined {
  const $ = cheerio.load(html);
  const pricePairs: { time: string; amount: string }[] = [];
  $("p").each((_, p) => {
    const t = cleanText($(p).text());
    const m = t.match(/(\d{1,2}[:.]\d{2}\s*[-–]\s*\d{1,2}[:.]\d{2})\s*\(([^)]+)\)\s*(\d{2,3}\s*kr)/i);
    if (m) {
      pricePairs.push({
        time: `${m[1]} (${m[2].trim()})`,
        amount: m[3].replace(/\s+/g, ""),
      });
    }
  });
  if (!pricePairs.length) return undefined;
  const ordinarie = pricePairs.find((p) => /ordinarie/i.test(p.time));
  const earlyBird = pricePairs.find((p) => /early-?bird/i.test(p.time));
  const base = ordinarie ?? pricePairs[0];
  return earlyBird && earlyBird !== base
    ? `${base.amount} (early-bird ${earlyBird.amount} ${earlyBird.time.replace(/\s*\(.*$/, "")})`
    : base.amount;
}

// --- Firestore REST values -------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** A Firestore REST document's `fields`, decoded to plain JS values. */
function firestoreFields(doc: unknown): Record<string, unknown> {
  if (!isRecord(doc) || !isRecord(doc.fields)) return {};
  return decodeMap(doc.fields);
}

function decodeMap(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, decode(v)]));
}

/** Decode one typed Firestore value ({stringValue: …}, {mapValue: …}, …). */
function decode(v: unknown): unknown {
  if (!isRecord(v)) return undefined;
  if ("mapValue" in v) {
    const m = v.mapValue;
    return isRecord(m) && isRecord(m.fields) ? decodeMap(m.fields) : {};
  }
  if ("arrayValue" in v) {
    const a = v.arrayValue;
    return isRecord(a) && Array.isArray(a.values) ? a.values.map(decode) : [];
  }
  if ("integerValue" in v) return Number(v.integerValue);
  if ("nullValue" in v) return null;
  const [scalar] = Object.values(v);
  return scalar;
}

/** The Swedish string of a localised {sv, en} map. */
function svText(v: unknown): string {
  return isRecord(v) && typeof v.sv === "string" ? v.sv : "";
}

// --- Dates ---------------------------------------------------------------

/** `now` as a UTC-midnight Date of its Europe/Stockholm calendar day. */
function stockholmDate(now: Date): Date {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return new Date(`${ymd}T00:00:00Z`);
}

/** "YYYY-MM-DD" for Monday–Friday of the ISO week containing `now`
 *  (Europe/Stockholm) — the keys Pej uses for its menu entries. */
function weekDates(now: Date): string[] {
  const today = stockholmDate(now);
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7));
  return WEEKDAYS.map((_, i) => {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}
