import test from "node:test";
import assert from "node:assert/strict";
import { parseTroppo } from "../../src/scrapers/troppo";
import { matchSnapshot, readFixture } from "../fixtures/snapshot";

test("parseTroppo matches snapshot", () => {
  const html = readFixture("troppo.html");
  matchSnapshot("troppo", parseTroppo(html));
});

// Troppo added Saturday lunch in October 2026 and renamed the menu heading
// from "Monday-Friday" to "Monday-Saturday" — that broke the 2026-10-12 build.
test("parseTroppo matches snapshot (Monday-Saturday heading)", () => {
  const html = readFixture("troppo-saturday.html");
  matchSnapshot("troppo-saturday", parseTroppo(html));
});

// Later the same day the heading became "SATURDAY-FRIDAY LUnch Menu": the day
// range is hand-edited churn, so only "Lunch Menu" is keyed on.
test("parseTroppo finds the menu whatever day range heads it", () => {
  const html = readFixture("troppo-saturday.html").replace(
    "Monday-Saturday LUnch Menu",
    "SATURDAY-FRIDAY LUnch Menu",
  );
  assert.ok(html.includes("SATURDAY-FRIDAY"), "fixture heading not swapped");
  assert.equal(parseTroppo(html).menu[0].lines.length, 3);
});
