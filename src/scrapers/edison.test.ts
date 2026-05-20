import test from "node:test";
import { parseElementorLunch } from "./elementor-lunch";
import { weekdayLunch } from "../hours";
import { matchSnapshot, readFixture } from "./__fixtures__/snapshot";

test("parseElementorLunch (edison) matches snapshot", () => {
  const html = readFixture("edison.html");
  matchSnapshot(
    "edison",
    parseElementorLunch(html, { hours: weekdayLunch("11:15", "13:30") }),
  );
});
