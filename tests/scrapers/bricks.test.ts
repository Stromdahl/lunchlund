import test from "node:test";
import assert from "node:assert/strict";
import { parseElementorLunch } from "../../src/scrapers/elementor-lunch";
import { weekdayLunch } from "../../src/hours";
import { matchSnapshot, readFixture } from "../fixtures/snapshot";

test("parseElementorLunch (bricks) matches snapshot", () => {
  const html = readFixture("bricks.html");
  matchSnapshot(
    "bricks",
    parseElementorLunch(html, { hours: weekdayLunch("11:00", "13:30") }),
  );
});

test("parseElementorLunch throws when no day menus are present", () => {
  // A bot-challenge interstitial / redesign loads with no .lunchmeny_container
  // day blocks — must surface as an error, not a silent empty menu.
  assert.throws(
    () => parseElementorLunch("<html><body><h1>Just a moment…</h1></body></html>"),
    /no day menus found/,
  );
});
