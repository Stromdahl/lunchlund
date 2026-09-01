import test from "node:test";
import assert from "node:assert/strict";
import { parseEateryLanding, parseEateryMenu } from "../../src/scrapers/eatery";
import { matchSnapshot, readFixture } from "../fixtures/snapshot";

test("parseEateryLanding picks PDF URL and price", () => {
  const html = readFixture("eatery-landing.html");
  const { pdfUrl, price } = parseEateryLanding(html);
  assert.match(pdfUrl, /Lund_sv_V\d+\.pdf/);
  matchSnapshot("eatery-landing", { pdfUrl, price });
});

test("parseEateryMenu reads days from pdftotext output", () => {
  const text = readFixture("eatery-menu.txt");
  matchSnapshot("eatery-menu", parseEateryMenu(text));
});

// The V25 PDF printed Monday's header as "MÅDAG" (dropped N). A strict
// equality match dropped the whole day; day detection now tolerates a
// one-character typo, so Monday must come back with its dishes. Regression
// guard for the blank Eatery card on 2026-06-15.
test("parseEateryMenu recovers a typo'd day header (MÅDAG → Måndag)", () => {
  const text = readFixture("eatery-menu-typo.txt");
  const { menu } = parseEateryMenu(text);
  const monday = menu.find((d) => d.day === "Måndag");
  assert.ok(monday, "Monday should be present despite the MÅDAG typo");
  assert.equal(monday!.lines.length, 3);
  matchSnapshot("eatery-menu-typo", parseEateryMenu(text));
});

// Guard for the false-positive surface flagged in #7: the fuzzy day-matcher
// must not promote chrome or other short lines to day headers. The closest
// chrome line, "STÄNGT", is the same length as the 6-char tokens but ≥2 edits
// away; "LUNCH"/"LUND"/"MENY V25"/"VECKAN" are out of range or ≥2 edits away.
// If any of them matched, extra (garbage) day entries would appear here.
test("parseEateryMenu does not treat chrome or short lines as day headers", () => {
  const text = [
    "LUNCH",
    "LUND",
    "MENY V25",
    "VECKAN",
    "MÅNDAG",
    "Korvstroganoff med chorizo",
    "STÄNGT",
  ].join("\n");
  const { menu } = parseEateryMenu(text);
  assert.deepEqual(menu.map((d) => d.day), ["Måndag"]);
  // "STÄNGT" after the header stays a dish line — it is not a second day.
  assert.deepEqual(menu[0].lines, ["Korvstroganoff med chorizo", "STÄNGT"]);
});

// Companion to #7: pin the matcher's tolerance band. A day word with one letter
// changed (substitution) or one letter dropped (deletion) is recovered — those
// are the observed pdftotext glitches. A day word plus a trailing character
// (insertion) is NOT a header: that widening was flagged in #7 and is now
// rejected, so such a line is absorbed as content rather than opening a
// spurious day. Anything ≥2 edits also stays content.
test("parseEateryMenu day detection recovers substitution/drop, rejects insertion and ≥2 edits", () => {
  const sub = parseEateryMenu("ONSDAB\nStekt fläsk med löksås");
  assert.deepEqual(sub.menu.map((d) => d.day), ["Onsdag"], "1 substitution");

  const drop = parseEateryMenu("MÅDAG\nKorvstroganoff med chorizo");
  assert.deepEqual(drop.menu.map((d) => d.day), ["Måndag"], "1 dropped letter");

  // Token + trailing char ("TISDAGX") must NOT open a day. Placed under a real
  // header so we can assert it is absorbed as a content line, not silently
  // dropped — proving "no spurious day", not merely "produced nothing".
  const ins = parseEateryMenu("MÅNDAG\nReal dish\nTISDAGX\nmore food");
  assert.deepEqual(ins.menu.map((d) => d.day), ["Måndag"], "trailing insert → content");
  assert.deepEqual(ins.menu[0].lines, ["Real dish", "TISDAGX", "more food"]);

  // "VECKANS" is in the length band (7 chars) but ≥2 edits from every token,
  // so it must NOT open a new day — it falls through as content.
  const far = parseEateryMenu("MÅNDAG\nReal dish\nVECKANS\nstill monday");
  assert.deepEqual(far.menu.map((d) => d.day), ["Måndag"], "≥2 edits → content");
  assert.equal(far.menu[0].lines.length, 3);
});

// Eatery's Swedish menu vanished from the site for the whole of week 35
// (2026-08-24 → 08-27: every build logged "no Lund_sv_V*.pdf link found"), and
// a re-upload naming the file "Lund_sv_V35-2.pdf" would have looked exactly the
// same to the old `Lund_sv_V\d+\.pdf` anchor. The pattern now tolerates a
// suffix between the week number and the extension.
test("parseEateryLanding accepts a re-uploaded PDF name (Lund_sv_V35-2.pdf)", () => {
  for (const name of ["Lund_sv_V35-2.pdf", "Lund_sv_V35%20(1).pdf", "Lund-sv-V35.pdf"]) {
    const html = `<html><body>
      <a href="https://static.thatsup.website/462/1/${name}?v=17">Lunchmeny</a>
    </body></html>`;
    const { pdfUrl } = parseEateryLanding(html);
    assert.equal(pdfUrl, `https://static.thatsup.website/462/1/${name}?v=17`);
  }
});

// Elementor stores a second copy of the button href inside its escaped
// data-settings JSON. If a template change leaves the URL only there, with no
// real <a href>, the raw-HTML sweep still finds it — bounded so it can't run
// backwards across the &quot; separators into the previous JSON key.
test("parseEateryLanding falls back to the URL in Elementor's settings blob", () => {
  const html = `<html><body><div class="btn" data-settings="{&quot;link&quot;:` +
    `&quot;https://static.thatsup.website/462/1/Lund_sv_V36.pdf?v=17&quot;,` +
    `&quot;label&quot;:&quot;Lunchmeny&quot;}"></div></body></html>`;
  const { pdfUrl } = parseEateryLanding(html);
  assert.equal(pdfUrl, "https://static.thatsup.website/462/1/Lund_sv_V36.pdf");
});

// The English PDF is NOT an acceptable substitute: parseEateryMenu keys on
// uppercase Swedish day tokens, so it would yield an empty menu — worse than an
// honest error card. A page carrying only Lund_eng must still throw.
test("parseEateryLanding does not fall back to the English PDF", () => {
  const html = `<html><body>
    <a href="https://static.thatsup.website/462/1/Lund_eng_V36.pdf">Menu</a>
  </body></html>`;
  assert.throws(() => parseEateryLanding(html), /no Lund_sv_V\*\.pdf link found/);
});
