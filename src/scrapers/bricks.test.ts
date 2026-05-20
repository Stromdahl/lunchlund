import test from "node:test";
import { parseElementorLunch } from "./elementor-lunch";
import { weekdayLunch } from "../hours";
import { matchSnapshot, readFixture } from "./__fixtures__/snapshot";

test("parseElementorLunch (bricks) matches snapshot", () => {
  const html = readFixture("bricks.html");
  matchSnapshot(
    "bricks",
    parseElementorLunch(html, { hours: weekdayLunch("11:00", "13:30") }),
  );
});
