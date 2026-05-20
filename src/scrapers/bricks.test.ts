import test from "node:test";
import { parseElementorLunch } from "./elementor-lunch";
import { weekdayLunch } from "../hours";
import { matchSnapshot, readFixture } from "./__fixtures__/snapshot";

test("parseElementorLunch (bricks) matches snapshot", () => {
  const html = readFixture("bricks.html");
  const r = parseElementorLunch(html, {
    url: "https://brickseatery.se/",
    name: "Bricks Eatery",
    address: "Mobilvägen 12, Lund",
    hours: weekdayLunch("11:00", "13:30"),
  });
  matchSnapshot("bricks", r);
});
