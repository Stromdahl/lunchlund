import test from "node:test";
import { parseElementorLunch } from "./elementor-lunch";
import { weekdayLunch } from "../hours";
import { matchSnapshot, readFixture } from "./__fixtures__/snapshot";

test("parseElementorLunch (inspira) matches snapshot", () => {
  const html = readFixture("inspira.html");
  matchSnapshot(
    "inspira",
    parseElementorLunch(html, { hours: weekdayLunch("11:30", "13:30") }),
  );
});
