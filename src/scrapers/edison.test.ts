import test from "node:test";
import { parseElementorLunch } from "./elementor-lunch";
import { weekdayLunch } from "../hours";
import { matchSnapshot, readFixture } from "./__fixtures__/snapshot";

test("parseElementorLunch (edison) matches snapshot", () => {
  const html = readFixture("edison.html");
  const r = parseElementorLunch(html, {
    url: "https://restaurangedison.se/lunch/",
    name: "Restaurang Edison",
    address: "Emdalavägen 6B, Lund",
    hours: weekdayLunch("11:15", "13:30"),
  });
  matchSnapshot("edison", r);
});
