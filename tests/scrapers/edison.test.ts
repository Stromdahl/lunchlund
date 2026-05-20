import test from "node:test";
import { parseElementorLunch } from "../../src/scrapers/elementor-lunch";
import { weekdayLunch } from "../../src/hours";
import { matchSnapshot, readFixture } from "../fixtures/snapshot";

test("parseElementorLunch (edison) matches snapshot", () => {
  const html = readFixture("edison.html");
  matchSnapshot(
    "edison",
    parseElementorLunch(html, { hours: weekdayLunch("11:15", "13:30") }),
  );
});
