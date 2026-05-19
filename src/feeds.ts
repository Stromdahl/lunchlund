import { ScrapeResult, Restaurant, DayMenu } from "./types";
import { translateDay } from "./hours";

// HTML page lives on the project Pages site; feeds are mirrored to the
// user-level Pages site so the canonical URLs are short.
const PAGE_URL = "https://stromdahl.github.io/lunchlund";
const FEED_BASE = "https://stromdahl.github.io";
const WEEKDAYS = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag"];

export function renderJson(result: ScrapeResult): string {
  return JSON.stringify(
    {
      fetchedAt: result.fetchedAt.toISOString(),
      restaurants: result.restaurants,
      errors: result.errors,
    },
    null,
    2,
  );
}

export function renderRss(result: ScrapeResult): string {
  const items = result.restaurants.flatMap((r) =>
    r.menu.map((day) => buildItem(r, day, result.fetchedAt)),
  );
  // Most recent first; readers usually expect descending order.
  items.sort((a, b) => b.pubDateMs - a.pubDateMs);

  const itemsXml = items.map((i) => i.xml).join("\n");
  const lastBuild = result.fetchedAt.toUTCString();

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Lunch near Mobilvägen 10</title>
    <link>${PAGE_URL}/</link>
    <atom:link href="${FEED_BASE}/lunchlund.xml" rel="self" type="application/rss+xml" />
    <description>Weekly lunch menus for restaurants nearest Mobilvägen 10, Lund.</description>
    <language>en</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
${itemsXml}
  </channel>
</rss>
`;
}

type RssItem = { xml: string; pubDateMs: number };

function buildItem(
  restaurant: Restaurant,
  day: DayMenu,
  fetchedAt: Date,
): RssItem {
  const date = weekdayDate(fetchedAt, day.day);
  // Use noon local time so the day always lands correctly regardless of TZ.
  date.setHours(12, 0, 0, 0);

  const slug = slugify(restaurant.name);
  const isoDate = date.toISOString().slice(0, 10);
  const guid = `lunchlund:${slug}:${isoDate}`;

  const descHtml = `<ul>${day.lines
    .map((l) => `<li>${escapeXml(l)}</li>`)
    .join("")}</ul>`;
  const title = `${restaurant.name} — ${translateDay(day.day)}`;

  const xml = `    <item>
      <title>${escapeXml(title)}</title>
      <link>${PAGE_URL}/#${slug}</link>
      <guid isPermaLink="false">${guid}</guid>
      <pubDate>${date.toUTCString()}</pubDate>
      <description>${escapeXml(descHtml)}</description>
    </item>`;

  return { xml, pubDateMs: date.getTime() };
}

function weekdayDate(reference: Date, swedishDay: string): Date {
  const idx = WEEKDAYS.findIndex(
    (d) => d.toLowerCase() === swedishDay.toLowerCase(),
  );
  if (idx === -1) return new Date(reference);
  // Find the Monday of the same ISO week as `reference`.
  const monday = new Date(reference);
  const refDow = (monday.getDay() + 6) % 7; // 0 = Mon … 6 = Sun
  monday.setDate(monday.getDate() - refDow);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() + idx);
  return monday;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
