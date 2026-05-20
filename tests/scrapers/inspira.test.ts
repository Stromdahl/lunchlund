import test from "node:test";
import { parseElementorLunch } from "../../src/scrapers/elementor-lunch";
import { weekdayLunch } from "../../src/hours";
import { matchSnapshot, readFixture } from "../fixtures/snapshot";

test("parseElementorLunch (inspira) matches snapshot", () => {
  const html = readFixture("inspira.html");
  matchSnapshot(
    "inspira",
    parseElementorLunch(html, { hours: weekdayLunch("11:30", "13:30") }),
  );
});
