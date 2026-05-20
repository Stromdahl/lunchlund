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
