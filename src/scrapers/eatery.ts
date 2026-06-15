import { spawn } from "node:child_process";
import * as cheerio from "cheerio";
import { DayMenu, ScrapedData, ScraperDescriptor } from "../types";
import { WEEKDAYS, weekdayLunch } from "../hours";
import { cleanText, fetchBuffer, fetchText } from "./lib";

const HOURS = weekdayLunch("11:00", "14:00");

const PAGE_URL = "https://eatery.se/anlaggningar/lund";
const DAY_TOKENS = WEEKDAYS.map((d) => d.svUpper);
const DAY_DISPLAY: Record<string, string> = Object.fromEntries(
  WEEKDAYS.map((d) => [d.svUpper, d.sv]),
);

async function scrapeEatery(): Promise<ScrapedData> {
  const html = await fetchText(PAGE_URL, "eatery page");
  const { pdfUrl, price } = parseEateryLanding(html);
  const pdf = await fetchBuffer(pdfUrl, "eatery pdf");
  const text = await pdfToText(pdf);
  const { menu, week } = parseEateryMenu(text);
  return { note: week, price, menu, hours: HOURS };
}

export const eatery: ScraperDescriptor = {
  id: "eatery",
  name: "Eatery Lund",
  address: "Mobilvägen 4, Lund",
  walkMinutes: 2,
  website: PAGE_URL,
  scrape: scrapeEatery,
};

export function parseEateryLanding(html: string): {
  pdfUrl: string;
  price?: string;
} {
  const $ = cheerio.load(html);

  // Pick the first link to a Lund_sv_V*.pdf — the Swedish weekly menu.
  let pdfUrl: string | undefined;
  $("a[href]").each((_, a) => {
    const href = $(a).attr("href") || "";
    if (/Lund_sv_V\d+\.pdf/i.test(href)) {
      pdfUrl = href;
      return false;
    }
  });
  if (!pdfUrl) throw new Error("eatery: no Lund_sv_V*.pdf link found on page");

  // The lunch section lists two prices in adjacent <p>'s:
  //   "11:00 - 11:30 (Early-bird)\n132kr"
  //   "11:00 - 14:00 (ordinarie)\n139kr"
  // We join into one display string.
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
  let price: string | undefined;
  if (pricePairs.length) {
    const ordinarie = pricePairs.find((p) => /ordinarie/i.test(p.time));
    const earlyBird = pricePairs.find((p) => /early-?bird/i.test(p.time));
    const base = ordinarie ?? pricePairs[0];
    price = earlyBird && earlyBird !== base
      ? `${base.amount} (early-bird ${earlyBird.amount} ${earlyBird.time.replace(/\s*\(.*$/, "")})`
      : base.amount;
  }

  return { pdfUrl, price };
}

function pdfToText(pdf: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("pdftotext", ["-layout", "-", "-"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    const chunks: Buffer[] = [];
    const errs: Buffer[] = [];
    proc.stdout.on("data", (c) => chunks.push(c));
    proc.stderr.on("data", (c) => errs.push(c));
    proc.on("error", (e) =>
      reject(
        new Error(
          `pdftotext not runnable (${e.message}). Install poppler-utils.`,
        ),
      ),
    );
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`pdftotext exited ${code}: ${Buffer.concat(errs)}`));
        return;
      }
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    proc.stdin.end(pdf);
  });
}

export function parseEateryMenu(text: string): {
  menu: DayMenu[];
  week?: string;
} {
  const lines = text.split(/\r?\n/).map((l) => l.trim());

  const weekMatch = text.match(/MENY\s+V(\d+)/i);
  const week = weekMatch ? `Lunchmeny V${weekMatch[1]}` : undefined;

  const menu: DayMenu[] = [];
  let current: DayMenu | null = null;

  for (const line of lines) {
    if (!line) continue;
    const dayToken = matchDayToken(line);
    if (dayToken) {
      current = { day: DAY_DISPLAY[dayToken], lines: [] };
      menu.push(current);
      continue;
    }
    if (!current) continue;
    if (isBoilerplate(line)) continue;
    current.lines.push(line.replace(/\s+/g, " "));
  }

  return { menu, week };
}

// A day header stands alone on its own line. pdftotext occasionally renders it
// with a dropped or stray letter — the V25 PDF printed "MÅDAG" for Monday,
// which the old exact-match gate skipped, silently swallowing that day's three
// dishes. So accept a line whose compacted (space-stripped, upper-cased) form
// is within one edit of a day token *and* of comparable length. Dish lines are
// long sentences that stay several edits clear of every token, and the chrome
// lines (LUNCH, MENY V25, LUND, STÄNGT, …) are all ≥2 edits away, so this won't
// false-positive. Returns the matched canonical token, or undefined.
function matchDayToken(line: string): string | undefined {
  const compact = line.toUpperCase().replace(/\s+/g, "");
  if (!compact) return undefined;
  return DAY_TOKENS.find(
    (d) => Math.abs(compact.length - d.length) <= 1 && withinOneEdit(compact, d),
  );
}

// True when `a` and `b` differ by at most one insertion, deletion, or
// substitution (Levenshtein distance ≤ 1). Cheap, allocation-free.
function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  if (la === lb) {
    let diff = 0;
    for (let i = 0; i < la; i++) {
      if (a[i] !== b[i] && ++diff > 1) return false;
    }
    return true;
  }
  // Lengths differ by one: walk both, allowing a single skip in the longer.
  const short = la < lb ? a : b;
  const long = la < lb ? b : a;
  let i = 0;
  let j = 0;
  let skipped = false;
  while (i < short.length && j < long.length) {
    if (short[i] === long[j]) {
      i++;
      j++;
    } else {
      if (skipped) return false;
      skipped = true;
      j++;
    }
  }
  return true;
}

function isBoilerplate(line: string): boolean {
  // Drop lines that are headers, disclaimers, or marketing chrome.
  const patterns = [
    /^LUNCH$/i,
    /^MENY/i,
    /^LUND$/i,
    /^Med reservation/i,
    /YOUR NEIGHBOURHOOD HERO/i,
    /SALLADSBUFFÉ/i,
    /EATERYAPPEN/i,
  ];
  return patterns.some((p) => p.test(line));
}
