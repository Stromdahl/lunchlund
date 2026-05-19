import { Restaurant, ScrapeResult } from "./types";
import { formatInterval, stockholmDayAndTime } from "./hours";

const WEEKDAYS = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag"];

function todayName(d: Date = new Date()): string | null {
  const idx = d.getDay(); // 0=Sun … 6=Sat
  if (idx < 1 || idx > 5) return null;
  return WEEKDAYS[idx - 1];
}

function fmtFetched(d: Date): string {
  return d.toLocaleString("sv-SE", {
    timeZone: "Europe/Stockholm",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const WEEKDAY_NAMES_LOWER = [
  "måndag",
  "tisdag",
  "onsdag",
  "torsdag",
  "fredag",
];

function isWeekdayLabel(s: string): boolean {
  return WEEKDAY_NAMES_LOWER.includes(s.trim().toLowerCase());
}

function renderRestaurant(
  r: Restaurant,
  today: string | null,
  fetchedAt: Date,
): string {
  // On a weekday, prefer a matching weekday entry; fall back to a non-weekday
  // entry (Troppo posts one "Hela veckan" menu for the whole week).
  const todayBlock = today
    ? (r.menu.find((m) => m.day.toLowerCase() === today.toLowerCase()) ??
        r.menu.find((m) => !isWeekdayLabel(m.day)) ??
        null)
    : null;
  const otherDays = r.menu.filter((m) => m !== todayBlock);

  const dayKey = stockholmDayAndTime(fetchedAt).day;
  const todayHours = r.hours?.[dayKey] ?? [];
  const hoursText = todayHours.length
    ? "Idag " + todayHours.map(formatInterval).join(", ")
    : "Stängt idag";
  const hoursAttr = r.hours
    ? ` data-hours="${escapeHtml(JSON.stringify(r.hours))}"`
    : "";

  const todayHtml = todayBlock
    ? `<div class="today">
        <div class="day-label">Idag · ${escapeHtml(todayBlock.day)}</div>
        <ul>${todayBlock.lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>
      </div>`
    : `<div class="empty-day">${
        today ? `Ingen meny för ${escapeHtml(today)}.` : "Helg — visar veckans meny nedan."
      }</div>`;

  const restHtml = otherDays.length
    ? `<details${today ? "" : " open"}><summary>Resten av veckan</summary>
        ${otherDays
          .map(
            (d) => `<div class="day">
              <div class="day-label">${escapeHtml(d.day)}</div>
              <ul>${d.lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>
            </div>`,
          )
          .join("")}
      </details>`
    : "";

  const link = r.website
    ? `<a class="site" href="${escapeHtml(r.website)}" target="_blank" rel="noopener">webbplats ↗</a>`
    : "";

  const note = r.note ? `<span class="note">${escapeHtml(r.note)}</span>` : "";
  const priceChip = r.price
    ? ` <span class="price">${escapeHtml(r.price)}</span>`
    : "";

  return `<article class="restaurant"${hoursAttr}>
    <header>
      <h2>${escapeHtml(r.name)} ${note}</h2>
      <div class="meta">${escapeHtml(r.address)}${priceChip} ${link}</div>
      <div class="hours-line">
        <span class="hours-today">${escapeHtml(hoursText)}</span>
        <span class="badge" aria-live="polite"></span>
      </div>
    </header>
    ${todayHtml}
    ${restHtml}
  </article>`;
}

export function render(result: ScrapeResult): string {
  const today = todayName(result.fetchedAt);
  const cards = result.restaurants
    .map((r) => renderRestaurant(r, today, result.fetchedAt))
    .join("\n");
  const errorList = result.errors.length
    ? `<div class="errors">
        <strong>Vissa källor misslyckades:</strong>
        <ul>${result.errors
          .map(
            (e) => `<li>${escapeHtml(e.source)}: ${escapeHtml(e.error)}</li>`,
          )
          .join("")}</ul>
      </div>`
    : "";

  return `<!doctype html>
<html lang="sv">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Lunch nära Mobilvägen 10</title>
  <style>
    :root {
      --bg: #fafaf7;
      --card: #ffffff;
      --ink: #1b1b1a;
      --muted: #6a6a66;
      --accent: #b34d17;
      --line: #e9e7df;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      background: var(--bg);
      color: var(--ink);
    }
    .wrap { max-width: 880px; margin: 0 auto; padding: 32px 20px 64px; }
    h1 { margin: 0 0 4px; font-size: 28px; }
    .sub { color: var(--muted); margin-bottom: 28px; font-size: 14px; }
    .restaurant {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 18px 20px;
      margin-bottom: 16px;
    }
    .restaurant h2 { margin: 0 0 4px; font-size: 18px; }
    .restaurant h2 .note { color: var(--muted); font-size: 13px; font-weight: 400; margin-left: 6px; }
    .meta { color: var(--muted); font-size: 13px; margin-bottom: 4px; }
    .meta .site { margin-left: 8px; color: var(--accent); text-decoration: none; }
    .meta .site:hover { text-decoration: underline; }
    .meta .price {
      display: inline-block;
      margin-left: 6px;
      padding: 1px 7px;
      font-size: 12px;
      border-radius: 999px;
      background: #f0ece4;
      color: #4a3a1f;
    }
    .hours-line { font-size: 13px; color: var(--muted); margin-bottom: 6px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .badge {
      display: inline-block; font-size: 12px; padding: 2px 8px; border-radius: 999px;
      background: #ececea; color: var(--muted);
    }
    .badge.open { background: #d8efd0; color: #1d5f0e; }
    .badge.closed { background: #f0dcd0; color: #8a2b00; }
    .badge:empty { display: none; }
    .day-label {
      font-weight: 600;
      font-size: 13px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--accent);
      margin-top: 8px;
    }
    .today { border-left: 3px solid var(--accent); padding-left: 12px; margin: 8px 0; }
    .empty-day { color: var(--muted); font-size: 14px; margin: 8px 0; }
    ul { margin: 4px 0 0; padding-left: 18px; }
    li { margin-bottom: 2px; }
    details { margin-top: 10px; }
    details summary { cursor: pointer; color: var(--muted); font-size: 14px; }
    details .day { margin-top: 8px; }
    .errors {
      background: #fff4ef; border: 1px solid #f1c2ac; color: #8a2b00;
      border-radius: 10px; padding: 12px 16px; margin: 0 0 16px; font-size: 14px;
    }
    .errors ul { margin: 6px 0 0; }
    footer { color: var(--muted); font-size: 12px; margin-top: 32px; text-align: center; }
    .empty { color: var(--muted); padding: 20px; text-align: center; }
  </style>
</head>
<body>
  <main class="wrap">
    <h1>Lunch nära Mobilvägen 10</h1>
    <div class="sub">Uppdaterad ${escapeHtml(fmtFetched(result.fetchedAt))}${
    today ? ` · ${escapeHtml(today)}` : " · helg"
  }</div>
    ${errorList}
    ${
      result.restaurants.length
        ? cards
        : `<div class="empty">Inga restauranger hittades.</div>`
    }
    <footer>
      <div>
        <a href="https://stromdahl.github.io/lunchlund.json">JSON</a> ·
        <a href="https://stromdahl.github.io/lunchlund.xml">RSS</a>
      </div>
      <div style="margin-top:6px">
        Källor:
        <a href="https://brickseatery.se/" target="_blank" rel="noopener">brickseatery.se</a> ·
        <a href="https://eatery.se/anlaggningar/lund" target="_blank" rel="noopener">eatery.se</a> ·
        <a href="https://www.kantinlund.se/" target="_blank" rel="noopener">kantinlund.se</a> ·
        <a href="https://restaurangedison.se/" target="_blank" rel="noopener">restaurangedison.se</a> ·
        <a href="https://restauranginspira.se/" target="_blank" rel="noopener">restauranginspira.se</a> ·
        <a href="https://www.troppo.se/lunch" target="_blank" rel="noopener">troppo.se</a>
      </div>
    </footer>
  </main>
  <script>
  (function () {
    var fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Stockholm",
      weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
    });
    var parts = fmt.formatToParts(new Date());
    function get(t) { var p = parts.find(function (x) { return x.type === t; }); return p ? p.value : ""; }
    var dow = get("weekday").toLowerCase().slice(0, 3);
    var nowMin = +get("hour") * 60 + +get("minute");
    function toMin(s) { var p = s.split(":"); return +p[0] * 60 + +p[1]; }
    function fmtInterval(i) { return i.open + "–" + i.close; }
    document.querySelectorAll(".restaurant[data-hours]").forEach(function (card) {
      var hours;
      try { hours = JSON.parse(card.dataset.hours); } catch (e) { return; }
      var badge = card.querySelector(".badge");
      var line = card.querySelector(".hours-today");
      var today = hours[dow] || [];
      if (line) line.textContent = today.length ? "Idag " + today.map(fmtInterval).join(", ") : "Stängt idag";
      if (!badge) return;
      var openNow = today.find(function (i) {
        return nowMin >= toMin(i.open) && nowMin < toMin(i.close);
      });
      if (openNow) {
        badge.textContent = "Öppet nu";
        badge.classList.add("open");
        return;
      }
      var next = today.find(function (i) { return toMin(i.open) > nowMin; });
      badge.textContent = next ? "Öppnar " + next.open : "Stängt";
      badge.classList.add("closed");
    });
  })();
  </script>
</body>
</html>
`;
}
