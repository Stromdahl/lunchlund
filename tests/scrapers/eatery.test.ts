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
