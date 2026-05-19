import { spawn } from "node:child_process";
import * as cheerio from "cheerio";
import { Restaurant, DayMenu } from "../types";
import { weekdayLunch } from "../hours";

const HOURS = weekdayLunch("11:00", "14:00");

const PAGE_URL = "https://eatery.se/anlaggningar/lund";
const DAY_TOKENS = ["MÅNDAG", "TISDAG", "ONSDAG", "TORSDAG", "FREDAG"];
const DAY_DISPLAY: Record<string, string> = {
  MÅNDAG: "Måndag",
  TISDAG: "Tisdag",
  ONSDAG: "Onsdag",
  TORSDAG: "Torsdag",
  FREDAG: "Fredag",
};

export async function scrapeEatery(): Promise<Restaurant> {
  const pdfUrl = await findCurrentPdfUrl();
  const pdf = await fetchPdf(pdfUrl);
  const text = await pdfToText(pdf);
  const { menu, week } = parseMenu(text);

  return {
    name: "Eatery Lund",
    address: "Mobilvägen 4, Lund",
    website: PAGE_URL,
    note: week,
    menu,
    hours: HOURS,
  };
}

async function findCurrentPdfUrl(): Promise<string> {
  const res = await fetch(PAGE_URL, {
    headers: { "user-agent": "lunchlund/0.1 (+local tool)" },
  });
  if (!res.ok) throw new Error(`eatery page: ${res.status} ${res.statusText}`);
  const $ = cheerio.load(await res.text());

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
  return pdfUrl;
}

async function fetchPdf(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`eatery pdf: ${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
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

function parseMenu(text: string): { menu: DayMenu[]; week?: string } {
  const lines = text.split(/\r?\n/).map((l) => l.trim());

  const weekMatch = text.match(/MENY\s+V(\d+)/i);
  const week = weekMatch ? `Lunchmeny V${weekMatch[1]}` : undefined;

  const menu: DayMenu[] = [];
  let current: DayMenu | null = null;

  for (const line of lines) {
    if (!line) continue;
    const upper = line.toUpperCase();
    const dayToken = DAY_TOKENS.find(
      (d) => upper === d || upper.startsWith(d + " ") || upper.endsWith(" " + d),
    );
    // The day appears centered on its own line — a strict equality match is
    // safest; the loose checks above guard against stray spacing.
    if (dayToken && upper.replace(/\s+/g, "") === dayToken) {
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
