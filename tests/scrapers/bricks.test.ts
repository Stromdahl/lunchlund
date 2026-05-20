import test from "node:test";
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
