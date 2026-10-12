import * as cheerio from "cheerio";
import { DayMenu, ScrapedData, ScraperDescriptor } from "../types";
import { WEEKDAYS, weekdayLunch } from "../hours";
import {
  ClosurePeriod,
  cleanText,
  fetchText,
  isClosedNow,
  parseClosurePeriod,
} from "./lib";

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
// other stems (e.g. "Klämdag – ingen lunch"). The holiday labels are followed by
// a "not a letter" guard so a compound that merely starts with them — "röd
// dagsfärsk lax", "helgdagsöppet" (the opposite, *open* on holidays) — doesn't
// read as closed. We spell that guard out as (?![...]) rather than \b because
// JS's \b counts only [A-Za-z0-9_] as word chars, so it would still fire before
// a glued å/ä/ö ("helgdagöppet"); the class includes the Swedish vowels.
const CLOSED_DAY =
  /stängt|stängd|röd\s*dag(?![\wåäöÅÄÖ])|helgdag(?![\wåäöÅÄÖ])|ingen\s+(?:lunch|servering|mat)/i;
// Kantin: kitchen serves until 15:00 (building open till 16:00).
const HOURS = weekdayLunch("11:00", "15:00");

// A label (a day name, or a weekly-extra heading) and the dish that follows it
// are separated by whitespace, a colon, or a dash — or, since Kantin started
// closing the bold with a <br> ("<strong>Måndag<br /></strong>Kalv tri-tip"), by
// nothing at all: cheerio's .text() drops the <br>, so the paragraph reads
// "MåndagKalv tri-tip" with no separator left to match on. That glue is what
// broke the 2026-09-01 build (every day paragraph silently skipped → "no day
// paragraphs found"). So accept the glued form, but only when the next
// character isn't a lowercase letter — that keeps a compound word
// ("Fredagsmys", "Torsdagsklassiker") from reading as a day label. The guard is
// an explicit character test rather than a lookahead in the pattern because the
// /i flag would make a lowercase class match uppercase too, rejecting the very
// "MåndagKalv" shape it exists to catch.
const SEPARATOR = /^[-:\s\u2010-\u2015\u2212]+/;

/** The first of `labels` that leads `full`, or undefined. */
function matchLabel(full: string, labels: string[]): string | undefined {
  return labels.find((lbl) => {
    if (!new RegExp(`^${lbl}`, "i").test(full)) return false;
    return !/[a-zåäö]/.test(full.charAt(lbl.length));
  });
}

/** `full` with its leading `label` and any following separator removed. */
function stripLabel(full: string, label: string): string {
  return full.slice(label.length).replace(SEPARATOR, "").trim();
}

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

    const day = matchLabel(full, DAYS);
    if (day) {
      const rest = stripLabel(full, day);
      if (rest) menu.push({ day, lines: [rest] });
      return;
    }

    const extraLbl = matchLabel(full, WEEKLY_EXTRAS);
    if (extraLbl) {
      const rest = stripLabel(full, extraLbl);
      if (rest) extras.set(extraLbl, `${extraLbl}: ${rest}`);
    }
  });
  if (menu.length === 0) menu.push(...parseDayStream($));
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

// cheerio doesn't re-export domhandler's node type and domhandler isn't a
// direct dependency (PnP won't resolve it), so lift it off load()'s signature.
type AnyNode = Exclude<Parameters<typeof cheerio.load>[0], string | Buffer | unknown[]>;

const BLOCK = /^(?:p|div|li|ul|ol|section|article|table|tr|td)$/;
const HEADING = /^h[1-6]$/;

/** One visual line of the page: its text, and the bold run that leads it. */
type Line =
  | { kind: "line"; text: string; lead: string }
  | { kind: "blockEnd" }
  | { kind: "heading" };

/** Flatten the document into visual lines — split at <br> and block edges —
 *  remembering each line's leading bold text, so a day label can be found
 *  wherever the markup puts it. */
function lines($: cheerio.CheerioAPI): Line[] {
  const out: Line[] = [];
  let text = "";
  let lead = "";
  let leadOpen = true;
  const end = () => {
    if (text) out.push({ kind: "line", text, lead });
    text = lead = "";
    leadOpen = true;
  };
  const visit = (node: AnyNode, bold: boolean) => {
    if (node.type === "text") {
      if (bold && leadOpen) lead += node.data;
      else if (cleanText(node.data)) leadOpen = false;
      text += node.data;
      return;
    }
    if (node.type !== "tag") return;
    if (node.name === "script" || node.name === "style") return;
    if (node.name === "br") return end();
    const inBold = bold || node.name === "b" || node.name === "strong";
    if (HEADING.test(node.name)) {
      end();
      out.push({ kind: "heading" });
      return;
    }
    const block = BLOCK.test(node.name);
    if (block) end();
    node.children.forEach((c) => visit(c, inBold));
    if (block) {
      end();
      out.push({ kind: "blockEnd" });
    }
  };
  $.root().children().each((_, n) => visit(n, false));
  end();
  return out;
}

/** Day menus from a page where the days aren't one-per-<p>. Kantin's
 *  2026-10-12 menu, pasted from webmail, put each bold day label in a <div>,
 *  sometimes sharing it with the previous day's dish:
 *    <div><b>Måndag</b><br>dish<br><br><b>Tisdag</b></div><div>dish</div>
 *  So walk visual lines: a line led by a bold day label opens a day (bold text
 *  after the label, e.g. "Torsdag – råbiffstorsdag", is a subtitle); following
 *  plain lines are its dish, until a blank line or block edge once a dish has
 *  been seen, a heading, or another bold label. */
function parseDayStream($: cheerio.CheerioAPI): DayMenu[] {
  const menu: DayMenu[] = [];
  let cur: { day: string; subtitle: string; dish: string[] } | undefined;
  const finish = () => {
    if (cur?.dish.length) {
      const dish = cur.dish.join(" ");
      const sub = cur.subtitle;
      const line = sub ? `${sub.charAt(0).toUpperCase()}${sub.slice(1)}: ${dish}` : dish;
      menu.push({ day: cur.day, lines: [line] });
    }
    cur = undefined;
  };
  for (const l of lines($)) {
    if (l.kind === "heading") {
      finish();
      continue;
    }
    if (l.kind === "blockEnd") {
      if (cur?.dish.length) finish();
      continue;
    }
    const full = cleanText(l.text);
    const lead = cleanText(l.lead);
    if (lead && full.startsWith(lead)) {
      const label = matchLabel(full, [...DAYS, ...WEEKLY_EXTRAS]);
      if (label) {
        finish();
        if (DAYS.includes(label)) {
          cur = { day: label, subtitle: stripLabel(lead, label), dish: [] };
          const rest = full.slice(lead.length).replace(SEPARATOR, "").trim();
          if (rest) cur.dish.push(rest);
        }
        continue;
      }
    }
    if (!cur) continue;
    if (full) cur.dish.push(full);
    else if (cur.dish.length) finish();
  }
  finish();
  return menu;
}

/** Find Kantin's whole-restaurant closure banner — a heading like
 *  "Semesterstängt 26/6-9/8" sitting above the (reopening-week) menu — and
 *  parse its window. Separate from parseKantin so the menu snapshot stays
 *  date-independent; resolveKantin applies the window against today's date. */
export function kantinClosure(html: string): ClosurePeriod | null {
  const $ = cheerio.load(html);
  let found: ClosurePeriod | null = null;
  $("h1, h2").each((_, el) => {
    const period = parseClosurePeriod(cleanText($(el).text()));
    if (period) {
      found = period;
      return false;
    }
  });
  return found;
}

/** Resolve Kantin against `now`: when the site announces a summer/holiday
 *  closure covering today, return a closed entry (no menu, no hours) so the
 *  card reads "Stängt idag" instead of the reopening-week menu Kantin keeps
 *  published beneath the banner. Otherwise the normal parse. Pure — `now` is
 *  injected so the menu-parse path stays testable and date-independent. */
export function resolveKantin(html: string, now: Date): ScrapedData {
  const closure = kantinClosure(html);
  if (closure && isClosedNow(closure, now)) {
    const until = `${closure.end.day}/${closure.end.month}`;
    return { menu: [], closed: { note: `${closure.label} t.o.m. ${until}` } };
  }
  return parseKantin(html);
}

export const kantin: ScraperDescriptor = {
  id: "kantin",
  name: "Kantin",
  address: "Brunnshögsgatan 14, Lund",
  walkMinutes: 7,
  website: URL,
  scrape: async () => resolveKantin(await fetchText(URL, "kantin"), new Date()),
};
